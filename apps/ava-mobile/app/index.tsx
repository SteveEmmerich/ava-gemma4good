import type { Blueprint } from "@ava/shared-types";
import { createSalClient } from "@ava/sal-client";
import { useAuth } from "@clerk/clerk-expo";
import * as React from "react";
import { Animated, Easing, Pressable, ScrollView, Text, TextInput, useWindowDimensions, View } from "react-native";
import { generateBlueprint } from "../src/blueprint/generate";
import { config } from "../src/config";
import { ed25519Crypto } from "../src/crypto/ed25519";
import { AvaLifecycle } from "../src/sal/state-machine";
import type { AvaLifecycleState } from "../src/sal/types";
import { secureStoreStorage } from "../src/storage/secure-store";

const sal = createSalClient({ identityUrl: config.vibebaseIdentityUrl });

const samplePrompt =
  "Build an assistant for a neighborhood food pantry that summarizes intake notes, drafts follow-up texts, tracks dietary preferences, and asks staff before sending.";

type ChatMessage = {
  id: string;
  role: "ava" | "user";
  text: string;
};

const initialMessages: ChatMessage[] = [
  {
    id: "ava-hello",
    role: "ava",
    text: "Tell me what your team needs help with. Include the job, who uses it, and what needs human approval."
  }
];

const examplePrompts = [
  samplePrompt,
  "Build an assistant for a youth tutoring nonprofit that matches volunteer tutors to students, tracks guardian consent, drafts schedule reminders, and asks staff before contacting families.",
  "Build an assistant for a legal aid clinic that triages appointment requests, flags urgent housing issues, drafts reminders, and requires attorney approval before legal guidance."
];

export default function Index() {
  const { width } = useWindowDimensions();
  const isWide = width >= 900;
  const isCompact = width < 640;
  const { getToken, isSignedIn, userId } = useAuth();
  const [state, setState] = React.useState<AvaLifecycleState>({ phase: "fresh" });
  const [messages, setMessages] = React.useState<ChatMessage[]>(initialMessages);
  const [draft, setDraft] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [mode, setMode] = React.useState<"create" | "preview">("create");
  const lifecycle = React.useRef<AvaLifecycle | null>(null);
  const glow = React.useRef(new Animated.Value(0)).current;
  const float = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(glow, {
            toValue: 1,
            duration: 2600,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: false
          }),
          Animated.timing(glow, {
            toValue: 0,
            duration: 2600,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: false
          })
        ]),
        Animated.sequence([
          Animated.timing(float, {
            toValue: 1,
            duration: 3100,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: false
          }),
          Animated.timing(float, {
            toValue: 0,
            duration: 3100,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: false
          })
        ])
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [float, glow]);

  React.useEffect(() => {
    lifecycle.current = new AvaLifecycle({
      storage: secureStoreStorage,
      crypto: ed25519Crypto,
      sal,
      auth: {
        async getJwt() {
          const token = await getToken();
          if (!token) {
            throw new Error("Sign in with Clerk to save and deploy.");
          }
          return token;
        },
        async getHumanId() {
          if (!userId) {
            throw new Error("Sign in with Clerk to save and deploy.");
          }
          return userId;
        }
      }
    });
  }, [getToken, userId]);

  const onGenerate = async (nextMode: "create" | "preview") => {
    const pendingDraft = draft.trim();
    const prompt = transcriptFromMessages(messages, pendingDraft);
    if (!prompt) {
      setState({ ...state, phase: "recoverable-error", error: "Describe the agent Ava should create." });
      return;
    }

    if (pendingDraft) {
      setMessages([
        ...messages,
        { id: `user-${Date.now()}`, role: "user", text: pendingDraft },
        {
          id: `ava-${Date.now()}`,
          role: "ava",
          text: "I have enough to create the first blueprint. I will keep the human approval boundary visible."
        }
      ]);
      setDraft("");
    }

    setMode(nextMode);
    setBusy(true);
    const result = await generateBlueprint(prompt);
    if (result.success) {
      const blueprintState = lifecycle.current?.setBlueprint(result.data) ?? { phase: "blueprint-ready" as const, blueprint: result.data };
      if (nextMode === "create") {
        const stagingState = await lifecycle.current?.createAnonymousToken(result.data.name);
        setState(stagingState ?? blueprintState);
      } else {
        setState(blueprintState);
      }
    } else {
      setState({ ...state, phase: "recoverable-error", error: result.error.message });
    }
    setBusy(false);
  };

  const onSendMessage = () => {
    const text = draft.trim();
    if (!text || busy) {
      return;
    }

    const nextMessages: ChatMessage[] = [
      ...messages,
      { id: `user-${Date.now()}`, role: "user", text }
    ];
    const reply = makeAvaReply(nextMessages);
    setMessages([...nextMessages, { id: `ava-${Date.now()}`, role: "ava", text: reply }]);
    setDraft("");
  };

  const onSaveDeploy = async () => {
    setBusy(true);
    setState((await lifecycle.current?.saveAndDeploy()) ?? state);
    setBusy(false);
  };

  const onUseExample = (prompt: string) => {
    if (busy) {
      return;
    }
    setDraft(prompt);
    setState({ phase: "fresh" });
  };

  const animatedBorder = glow.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgba(84, 214, 194, 0.22)", "rgba(255, 157, 115, 0.78)"]
  });
  const floatingPhone = float.interpolate({ inputRange: [0, 1], outputRange: [0, -16] });
  const floatingCard = float.interpolate({ inputRange: [0, 1], outputRange: [0, -10] });
  const latestUserMessage =
    draft.trim() ||
    [...messages].reverse().find((message) => message.role === "user")?.text ||
    "Describe the helper your team needs.";

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{
        minHeight: "100%",
        backgroundColor: "#081110",
        paddingHorizontal: isWide ? 30 : 16,
        paddingTop: 16,
        paddingBottom: 36,
        gap: 28
      }}
    >
      <View
        style={{
          width: "100%",
          maxWidth: 1180,
          alignSelf: "center",
          gap: 30
        }}
      >
        <TopNav />

        <View
          style={{
            minHeight: isWide ? 650 : undefined,
            flexDirection: isWide ? "row" : "column",
            alignItems: "center",
            gap: isWide ? 34 : 24,
            paddingTop: isWide ? 22 : 8
          }}
        >
          <View style={{ flex: 1.03, width: "100%", gap: 22 }}>
            <View style={{ gap: 16 }}>
              <Kicker label="Community service agents, claimable later" />
              <Text
                selectable
                style={{
                  color: "#f8f3ea",
                  fontSize: isWide ? 80 : isCompact ? 46 : 60,
                  lineHeight: isWide ? 76 : isCompact ? 46 : 58,
                  fontWeight: "900",
                  letterSpacing: 0,
                  maxWidth: 760
                }}
              >
                Describe the help. Ava builds the agent.
              </Text>
              <Text
                selectable
                style={{
                  color: "rgba(248, 243, 234, 0.72)",
                  fontSize: isCompact ? 17 : 19,
                  lineHeight: isCompact ? 27 : 30,
                  maxWidth: 640
                }}
              >
                Ava helps small nonprofits and community teams turn plain-language needs into safe, claimable AI
                agents with human approval built into the workflow.
              </Text>
            </View>

            <PromptComposer
              busy={busy}
              isSignedIn={!!isSignedIn}
              mode={mode}
              phase={state.phase}
              state={state}
              draft={draft}
              messages={messages}
              onChangeDraft={setDraft}
              onGenerate={onGenerate}
              onSendMessage={onSendMessage}
              onUseExample={onUseExample}
              onSaveDeploy={onSaveDeploy}
            />
          </View>

          <View style={{ flex: 0.93, width: "100%", minHeight: isWide ? 650 : isCompact ? 560 : 640 }}>
            {!isCompact ? (
              <>
                <Animated.View
                  style={{
                    position: "absolute",
                    left: 0,
                    top: isWide ? 118 : 24,
                    transform: [{ translateY: floatingCard }],
                    zIndex: 2
                  }}
                >
                  <OrbitCard title="Stateless brain" body="Transcript in, schema-valid JSON blueprint out." />
                </Animated.View>
                <Animated.View
                  style={{
                    position: "absolute",
                    left: isWide ? 18 : 0,
                    bottom: isWide ? 102 : 18,
                    transform: [{ translateY: floatingCard }],
                    zIndex: 2
                  }}
                >
                  <OrbitCard title="Canonical SAL" body="Keypair, challenge, signature, token. No side channel." wide />
                </Animated.View>
              </>
            ) : null}

            <Animated.View
              style={{
                alignSelf: isWide ? "flex-end" : "center",
                width: isCompact ? "100%" : 340,
                maxWidth: "100%",
                minHeight: isCompact ? 540 : 602,
                borderRadius: isCompact ? 24 : 34,
                padding: 14,
                borderWidth: 1,
                borderColor: animatedBorder,
                borderCurve: "continuous",
                backgroundColor: "#111b1a",
                boxShadow: "0 50px 110px rgba(0, 0, 0, 0.44)",
                transform: [{ translateY: floatingPhone }]
              }}
            >
              <View
                style={{
                  flex: 1,
                  borderRadius: isCompact ? 18 : 24,
                  borderCurve: "continuous",
                  overflow: "hidden",
                  backgroundColor: "#f8f3ea"
                }}
              >
                <View style={{ gap: 16, padding: 18 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <Text selectable style={{ color: "#5d625d", fontSize: 12, fontWeight: "900" }}>
                      AVA
                    </Text>
                    <StatusBadge phase={state.phase} />
                  </View>

                  <View
                    style={{
                      gap: 8,
                      padding: 14,
                      borderRadius: 8,
                      borderCurve: "continuous",
                      backgroundColor: "rgba(255, 255, 255, 0.78)",
                      borderWidth: 1,
                      borderColor: "rgba(20, 33, 31, 0.1)",
                      boxShadow: "0 12px 30px rgba(20, 33, 31, 0.08)"
                    }}
                  >
                    <Text selectable style={{ color: "#14211f", fontSize: 13, fontWeight: "900" }}>
                      Transcript
                    </Text>
                    <Text selectable style={{ color: "#58615e", fontSize: 13, lineHeight: 19 }}>
                      {summarizeForPhone(latestUserMessage)}
                    </Text>
                  </View>

                  <BlueprintPanel blueprint={state.blueprint} />

                  {state.blueprint ? <MiniUsagePlan blueprint={state.blueprint} /> : null}

                  <View style={{ gap: 8 }}>
                    <PulseLine />
                    <MetricRow label="Agent" value={state.agentId ? shortId(state.agentId) : "pending"} light />
                    <MetricRow label="Token" value={state.token ? `${state.token.accessToken.slice(0, 18)}...` : "pending"} light />
                    <MetricRow label="Brain" value={config.avaBrainUrl.replace(/^https?:\/\//, "")} light />
                  </View>
                </View>
              </View>
            </Animated.View>
          </View>
        </View>

        <View
          style={{
            gap: 18,
            marginHorizontal: isWide ? -30 : -16,
            marginBottom: -36,
            paddingHorizontal: isWide ? 30 : 16,
            paddingTop: 36,
            paddingBottom: 40,
            backgroundColor: "#f4ead8"
          }}
        >
          <Text
            selectable
            style={{
              color: "#17201f",
              fontSize: isCompact ? 34 : 48,
              lineHeight: isCompact ? 37 : 48,
              fontWeight: "900",
              letterSpacing: 0
            }}
          >
            A real creation flow, not a mockup.
          </Text>
          <View style={{ flexDirection: isWide ? "row" : "column", gap: 14 }}>
            <BoundaryCard
              title="Gemma 4 Brain"
              body="Stateless transcript to JSON blueprint generation, validated before returning."
            />
            <BoundaryCard
              title="Vibebase SAL"
              body="Identity init, challenge, claim, and token exchange stay behind Vibebase contracts."
            />
            <BoundaryCard
              title="Expo Client"
              body="One React Native surface for mobile and web, with local key custody and recoverable states."
            />
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

function TopNav() {
  return (
    <View
      style={{
        minHeight: 54,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 8,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: "rgba(248, 243, 234, 0.16)",
        backgroundColor: "rgba(8, 17, 16, 0.84)",
        boxShadow: "0 24px 70px rgba(0, 0, 0, 0.24)"
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            borderCurve: "continuous",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#54d6c2"
          }}
        >
          <Text selectable style={{ color: "#081110", fontWeight: "900" }}>
            A
          </Text>
        </View>
        <Text selectable style={{ color: "#f8f3ea", fontSize: 16, fontWeight: "900" }}>
          Ava
        </Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <NavPill label="Live SAL" />
        <NavPill label="Gemma 4" solid />
      </View>
    </View>
  );
}

function PromptComposer({
  busy,
  draft,
  isSignedIn,
  messages,
  mode,
  phase,
  state,
  onChangeDraft,
  onGenerate,
  onSendMessage,
  onUseExample,
  onSaveDeploy
}: {
  busy: boolean;
  draft: string;
  isSignedIn: boolean;
  messages: ChatMessage[];
  mode: "create" | "preview";
  phase: string;
  state: AvaLifecycleState;
  onChangeDraft: (value: string) => void;
  onGenerate: (mode: "create" | "preview") => Promise<void>;
  onSendMessage: () => void;
  onUseExample: (prompt: string) => void;
  onSaveDeploy: () => Promise<void>;
}) {
  const hasTranscript = transcriptFromMessages(messages, draft.trim()).length > 0;
  const hasUserMessage = messages.some((message) => message.role === "user");

  return (
    <View
      style={{
        gap: 14,
        padding: 16,
        borderRadius: 8,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: "rgba(248, 243, 234, 0.16)",
        backgroundColor: "rgba(248, 243, 234, 0.08)",
        boxShadow: "0 28px 70px rgba(0, 0, 0, 0.24)"
      }}
    >
      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <Text selectable style={{ color: "#f8f3ea", fontSize: 22, lineHeight: 27, fontWeight: "900" }}>
            Start with one real workflow
          </Text>
          <Text selectable style={{ color: "#aaf2e7", fontSize: 12, fontWeight: "900" }}>
            {phase}
          </Text>
        </View>
        <Text selectable style={{ color: "rgba(248, 243, 234, 0.7)", fontSize: 15, lineHeight: 22 }}>
          Type what the team does, what Ava should draft or track, and what must stay human-approved.
        </Text>
      </View>

      <ScrollView
        nestedScrollEnabled
        style={{
          display: hasUserMessage ? "flex" : "none",
          maxHeight: 260,
          borderRadius: 8,
          borderCurve: "continuous",
          borderWidth: 1,
          borderColor: "rgba(248, 243, 234, 0.16)",
          backgroundColor: "rgba(255, 253, 248, 0.08)"
        }}
        contentContainerStyle={{
          gap: 10,
          padding: 12
        }}
      >
        {messages.filter((message) => message.role === "user" || hasUserMessage).map((message) => (
          <ChatBubble key={message.id} message={message} />
        ))}
      </ScrollView>

      <View style={{ gap: 10 }}>
        <TextInput
          multiline
          value={draft}
          onChangeText={onChangeDraft}
          placeholder="Example: Help our clinic triage appointment requests, flag urgent housing issues, draft reminders, and require attorney approval before legal guidance."
          placeholderTextColor="rgba(248, 243, 234, 0.46)"
          onSubmitEditing={onSendMessage}
          style={{
            minHeight: 132,
            maxHeight: 190,
            padding: 14,
            borderRadius: 8,
            borderCurve: "continuous",
            borderWidth: 1,
            borderColor: "rgba(248, 243, 234, 0.16)",
            backgroundColor: "rgba(255, 253, 248, 0.1)",
            color: "#f8f3ea",
            fontSize: 16,
            lineHeight: 22,
            textAlignVertical: "top",
            outlineColor: "#54d6c2"
          }}
        />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <ExampleButton label="Food pantry" onPress={() => onUseExample(examplePrompts[0])} />
          <ExampleButton label="Youth tutoring" onPress={() => onUseExample(examplePrompts[1])} />
          <ExampleButton label="Legal aid" onPress={() => onUseExample(examplePrompts[2])} />
        </View>
      </View>

      {state.error ? (
        <View style={{ padding: 12, borderRadius: 8, borderCurve: "continuous", backgroundColor: "#4b2721" }}>
          <Text selectable style={{ color: "#ffe0d5", fontWeight: "900" }}>
            Try again
          </Text>
          <Text selectable style={{ color: "#ffe0d5", lineHeight: 21 }}>
            {state.error}
          </Text>
        </View>
      ) : null}

      {state.agentId ? <StagingIdentity state={state} /> : null}

      {state.blueprint ? <HumanReviewPlan blueprint={state.blueprint} hasIdentity={!!state.agentId} /> : null}

      <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
        <ActionButton
          disabled={busy}
          label={busy && mode === "create" ? "Creating..." : "Create My Ava"}
          tone="primary"
          onPress={() => void onGenerate("create")}
        />
        <ActionButton
          disabled={busy}
          label={busy && mode === "preview" ? "Previewing..." : "Preview only"}
          tone="glass"
          onPress={() => void onGenerate("preview")}
        />
        {draft.trim().length > 0 ? (
          <ActionButton
            disabled={busy || draft.trim().length === 0}
            label="Add detail"
            tone="glass"
            onPress={onSendMessage}
          />
        ) : null}
        {state.phase === "blueprint-ready" && isSignedIn ? (
          <ActionButton
            disabled={busy}
            label="Claim with Clerk"
            tone="light"
            onPress={() => void onSaveDeploy()}
          />
        ) : null}
      </View>

      {!isSignedIn ? (
        <Text selectable style={{ color: "rgba(248, 243, 234, 0.64)", lineHeight: 22 }}>
          No sign-in needed for the demo. Ava creates a staging agent first, then shows a claim URL.
        </Text>
      ) : null}
    </View>
  );
}

function StagingIdentity({ state }: { state: AvaLifecycleState }) {
  return (
    <View
      style={{
        gap: 10,
        padding: 14,
        borderRadius: 8,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: "rgba(84, 214, 194, 0.28)",
        backgroundColor: "rgba(84, 214, 194, 0.1)"
      }}
    >
      <Text selectable style={{ color: "#aaf2e7", fontSize: 12, fontWeight: "900" }}>
        Staging identity
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        <MetricRow label="Agent" value={shortId(state.agentId ?? "")} />
        <MetricRow label="Tier" value={state.tier ?? state.phase} />
        <MetricRow label="Token" value={state.token ? `${state.token.accessToken.slice(0, 18)}...` : "pending"} />
      </View>
      {state.claimUrl ? (
        <Text selectable style={{ color: "rgba(248, 243, 234, 0.76)", lineHeight: 21 }} numberOfLines={3}>
          Claim URL: {state.claimUrl}
        </Text>
      ) : null}
    </View>
  );
}

function HumanReviewPlan({ blueprint, hasIdentity }: { blueprint: Blueprint; hasIdentity: boolean }) {
  const primaryAction = blueprint.actions[0]?.label ?? "Start with the highest-risk workflow";
  const primaryBoundary = blueprint.persona.boundaries[0] ?? "Decide what must require staff approval";

  return (
    <View
      style={{
        gap: 14,
        padding: 14,
        borderRadius: 8,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: "rgba(248, 243, 234, 0.16)",
        backgroundColor: "rgba(248, 243, 234, 0.08)"
      }}
    >
      <View style={{ gap: 6 }}>
        <Text selectable style={{ color: "#f8f3ea", fontSize: 20, lineHeight: 25, fontWeight: "900" }}>
          Review this plan before anyone uses it
        </Text>
        <Text selectable style={{ color: "rgba(248, 243, 234, 0.72)", fontSize: 15, lineHeight: 22 }}>
          Ava created a safe starting point: a plain-English agent plan, visible safety boundaries, and
          {hasIdentity ? " a claimable staging identity." : " a preview you can create into a staging identity."}
        </Text>
      </View>

      <View style={{ gap: 8 }}>
        <ReviewRow label="What this assistant is for" value={blueprint.description} />
        <ReviewRow label="First workflow to test" value={primaryAction} />
        <ReviewRow label="Approval boundary to confirm" value={primaryBoundary} />
      </View>

      <View
        style={{
          gap: 10,
          padding: 12,
          borderRadius: 8,
          borderCurve: "continuous",
          backgroundColor: "rgba(84, 214, 194, 0.1)"
        }}
      >
        <Text selectable style={{ color: "#aaf2e7", fontSize: 13, fontWeight: "900" }}>
          Now that you have this, use it like this
        </Text>
        <InstructionStep index={1} text="Read the purpose and remove anything that does not match the real team workflow." />
        <InstructionStep index={2} text="Check each action and decide what data, tool, or staff role it needs before deployment." />
        <InstructionStep index={3} text="Confirm the human approval rules before the assistant drafts, sends, or escalates anything." />
        <InstructionStep
          index={4}
          text={
            hasIdentity
              ? "Share the plan and claim URL with the person who will own the assistant."
              : "Create the staging identity when the plan is ready to hand to an owner."
          }
        />
        <InstructionStep index={5} text="Use the blueprint as the implementation checklist for the technical partner or admin." />
      </View>
    </View>
  );
}

function MiniUsagePlan({ blueprint }: { blueprint: Blueprint }) {
  const boundary = blueprint.persona.boundaries[0] ?? "Keep staff approval visible";

  return (
    <View
      style={{
        gap: 8,
        padding: 12,
        borderRadius: 8,
        borderCurve: "continuous",
        backgroundColor: "rgba(255, 255, 255, 0.78)",
        borderWidth: 1,
        borderColor: "rgba(20, 33, 31, 0.1)"
      }}
    >
      <Text selectable style={{ color: "#14211f", fontSize: 13, fontWeight: "900" }}>
        Human handoff
      </Text>
      <Text selectable style={{ color: "#58615e", fontSize: 13, lineHeight: 19 }}>
        Review {blueprint.name}, confirm "{boundary}", then share the plan and claim URL with the owner.
      </Text>
    </View>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ gap: 4 }}>
      <Text selectable style={{ color: "#aaf2e7", fontSize: 12, fontWeight: "900" }}>
        {label}
      </Text>
      <Text selectable style={{ color: "rgba(248, 243, 234, 0.78)", lineHeight: 21 }}>
        {value}
      </Text>
    </View>
  );
}

function InstructionStep({ index, text }: { index: number; text: string }) {
  return (
    <View style={{ flexDirection: "row", gap: 9, alignItems: "flex-start" }}>
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 999,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#54d6c2"
        }}
      >
        <Text selectable style={{ color: "#081110", fontSize: 12, fontWeight: "900" }}>
          {index}
        </Text>
      </View>
      <Text selectable style={{ flex: 1, color: "rgba(248, 243, 234, 0.78)", lineHeight: 21 }}>
        {text}
      </Text>
    </View>
  );
}

function BlueprintPanel({ blueprint }: { blueprint?: Blueprint }) {
  if (!blueprint) {
    return (
      <View
        style={{
          gap: 10,
          padding: 14,
          borderRadius: 8,
          borderCurve: "continuous",
          backgroundColor: "#14211f"
        }}
      >
        <Text selectable style={{ color: "#f8f3ea", fontSize: 24, lineHeight: 30, fontWeight: "900" }}>
          Waiting for a fresh blueprint
        </Text>
        <Text selectable style={{ color: "rgba(248, 243, 234, 0.72)", lineHeight: 22 }}>
          Create from the prompt to see the agent name, boundaries, triggers, and workflow actions.
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7, paddingTop: 2 }}>
          <Chip label="intake" />
          <Chip label="approval" />
          <Chip label="follow-up" />
        </View>
      </View>
    );
  }

  return (
    <View style={{ gap: 12 }}>
      <View style={{ gap: 8, padding: 14, borderRadius: 8, borderCurve: "continuous", backgroundColor: "#14211f" }}>
        <Text selectable style={{ color: "#f8f3ea", fontSize: 24, lineHeight: 30, fontWeight: "900" }}>
          {blueprint.name}
        </Text>
        <Text selectable style={{ color: "rgba(248, 243, 234, 0.72)", lineHeight: 22 }}>
          {blueprint.description}
        </Text>
      </View>

      <View style={{ gap: 8 }}>
        <Text selectable style={{ color: "#263531", fontSize: 12, fontWeight: "900" }}>
          Actions
        </Text>
        {blueprint.actions.slice(0, 3).map((action) => (
          <View
            key={action.id}
            style={{
              padding: 11,
              borderRadius: 8,
              borderCurve: "continuous",
              backgroundColor: "rgba(84, 214, 194, 0.14)"
            }}
          >
            <Text selectable style={{ color: "#14211f", fontWeight: "900" }}>
              {action.label}
            </Text>
          </View>
        ))}
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
        {blueprint.persona.boundaries.slice(0, 3).map((boundary) => (
          <Chip key={boundary} label={boundary} dark />
        ))}
      </View>
    </View>
  );
}

function ChatBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <View
      style={{
        alignSelf: isUser ? "flex-end" : "flex-start",
        maxWidth: "88%",
        gap: 5,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 8,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: isUser ? "rgba(84, 214, 194, 0.34)" : "rgba(248, 243, 234, 0.13)",
        backgroundColor: isUser ? "rgba(84, 214, 194, 0.16)" : "rgba(248, 243, 234, 0.08)"
      }}
    >
      <Text
        selectable
        style={{
          color: isUser ? "#aaf2e7" : "rgba(248, 243, 234, 0.62)",
          fontSize: 11,
          fontWeight: "900"
        }}
      >
        {isUser ? "You" : "Ava"}
      </Text>
      <Text selectable style={{ color: "#f8f3ea", fontSize: 14, lineHeight: 21 }}>
        {message.text}
      </Text>
    </View>
  );
}

function StatusBadge({ phase }: { phase: string }) {
  return (
    <View
      style={{
        minHeight: 28,
        justifyContent: "center",
        paddingHorizontal: 9,
        borderRadius: 999,
        backgroundColor: "rgba(84, 214, 194, 0.13)"
      }}
    >
      <Text selectable style={{ color: "#185c62", fontSize: 11, fontWeight: "900" }}>
        {phase}
      </Text>
    </View>
  );
}

function ActionButton({
  disabled,
  label,
  tone,
  onPress
}: {
  disabled: boolean;
  label: string;
  tone: "primary" | "glass" | "light";
  onPress: () => void;
}) {
  const backgroundColor =
    tone === "primary" ? "#54d6c2" : tone === "light" ? "#f8f3ea" : "rgba(248, 243, 234, 0.08)";
  const borderColor = tone === "glass" ? "rgba(248, 243, 234, 0.16)" : backgroundColor;
  const color = tone === "glass" ? "#f8f3ea" : "#081110";

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={{
        minHeight: 48,
        justifyContent: "center",
        paddingHorizontal: 18,
        borderRadius: 8,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: disabled ? "rgba(248, 243, 234, 0.14)" : borderColor,
        backgroundColor: disabled ? "rgba(248, 243, 234, 0.18)" : backgroundColor,
        boxShadow: tone === "primary" && !disabled ? "0 16px 40px rgba(84, 214, 194, 0.2)" : "none"
      }}
    >
      <Text style={{ color: disabled ? "rgba(248, 243, 234, 0.54)" : color, fontWeight: "900" }}>
        {label}
      </Text>
    </Pressable>
  );
}

function ExampleButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{
        minHeight: 36,
        justifyContent: "center",
        paddingHorizontal: 12,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: "rgba(84, 214, 194, 0.28)",
        backgroundColor: "rgba(84, 214, 194, 0.12)"
      }}
    >
      <Text style={{ color: "#aaf2e7", fontSize: 13, fontWeight: "900" }}>{label}</Text>
    </Pressable>
  );
}

function MetricRow({ label, value, light = false }: { label: string; value: string; light?: boolean }) {
  return (
    <View style={{ gap: 4 }}>
      <Text selectable style={{ color: light ? "#69726f" : "rgba(248, 243, 234, 0.62)", fontSize: 12, fontWeight: "900" }}>
        {label}
      </Text>
      <Text
        selectable
        style={{ color: light ? "#14211f" : "#f8f3ea", fontSize: 15, fontWeight: "900" }}
        numberOfLines={2}
      >
        {value}
      </Text>
    </View>
  );
}

function BoundaryCard({ title, body }: { title: string; body: string }) {
  return (
    <View
      style={{
        flex: 1,
        minHeight: 184,
        justifyContent: "flex-end",
        gap: 8,
        padding: 18,
        borderRadius: 8,
        borderCurve: "continuous",
        backgroundColor: "#fffdf8",
        borderWidth: 1,
        borderColor: "rgba(31, 37, 34, 0.12)",
        boxShadow: "0 18px 50px rgba(31, 37, 34, 0.07)"
      }}
    >
      <Text selectable style={{ color: "#17201f", fontSize: 18, fontWeight: "900" }}>
        {title}
      </Text>
      <Text selectable style={{ color: "#5d5850", lineHeight: 22 }}>
        {body}
      </Text>
    </View>
  );
}

function OrbitCard({ title, body, wide = false }: { title: string; body: string; wide?: boolean }) {
  return (
    <View
      style={{
        width: wide ? 260 : 235,
        gap: 4,
        padding: 14,
        borderRadius: 8,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: "rgba(248, 243, 234, 0.15)",
        backgroundColor: "rgba(248, 243, 234, 0.1)",
        boxShadow: "0 28px 70px rgba(0, 0, 0, 0.24)"
      }}
    >
      <Text selectable style={{ color: "#f8f3ea", fontWeight: "900" }}>
        {title}
      </Text>
      <Text selectable style={{ color: "rgba(248, 243, 234, 0.68)", fontSize: 13, lineHeight: 18 }}>
        {body}
      </Text>
    </View>
  );
}

function Kicker({ label }: { label: string }) {
  return (
    <View
      style={{
        alignSelf: "flex-start",
        borderWidth: 1,
        borderColor: "rgba(84, 214, 194, 0.28)",
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 7,
        backgroundColor: "rgba(84, 214, 194, 0.09)"
      }}
    >
      <Text selectable style={{ color: "#aaf2e7", fontSize: 13, fontWeight: "900" }}>
        {label}
      </Text>
    </View>
  );
}

function NavPill({ label, solid = false }: { label: string; solid?: boolean }) {
  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: solid ? "transparent" : "rgba(248, 243, 234, 0.16)",
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 8,
        backgroundColor: solid ? "#f8f3ea" : "transparent"
      }}
    >
      <Text selectable style={{ color: solid ? "#081110" : "rgba(248, 243, 234, 0.78)", fontSize: 13, fontWeight: "900" }}>
        {label}
      </Text>
    </View>
  );
}

function Chip({ label, dark = false }: { label: string; dark?: boolean }) {
  return (
    <View
      style={{
        borderRadius: 999,
        paddingHorizontal: 9,
        paddingVertical: 6,
        backgroundColor: dark ? "rgba(20, 33, 31, 0.07)" : "rgba(84, 214, 194, 0.12)"
      }}
    >
      <Text selectable style={{ color: dark ? "#35504a" : "#aaf2e7", fontSize: 12, fontWeight: "900" }} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

function PulseLine() {
  return (
    <View
      style={{
        height: 9,
        borderRadius: 999,
        backgroundColor: "#54d6c2",
        opacity: 0.8
      }}
    />
  );
}

function shortId(value: string): string {
  return value.length > 18 ? `${value.slice(0, 8)}...${value.slice(-6)}` : value;
}

function transcriptFromMessages(messages: ChatMessage[], pendingDraft = ""): string {
  const turns = messages
    .filter((message) => message.role === "user")
    .map((message) => message.text.trim())
    .filter(Boolean);

  if (pendingDraft.trim()) {
    turns.push(pendingDraft.trim());
  }

  return turns
    .join("\n\n");
}

function makeAvaReply(messages: ChatMessage[]): string {
  const userTurns = messages.filter((message) => message.role === "user").length;
  const last = messages[messages.length - 1]?.text.toLowerCase() ?? "";

  if (userTurns <= 1) {
    return "That is a strong start. Who is the primary user, and what decisions should the agent never make without a human?";
  }

  if (!/approve|approval|human|staff|review|permission/.test(last)) {
    return "Helpful. What should require explicit human approval before the agent acts?";
  }

  if (!/text|email|sms|notify|message|follow/.test(last)) {
    return "Got it. Should this agent draft messages, trigger workflows, remember preferences, or only summarize information?";
  }

  return "Great. I have enough to draft the blueprint now. Create My Ava will send this conversation to the Brain and turn it into actions, boundaries, and triggers.";
}

function summarizeForPhone(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (trimmed.length <= 92) {
    return trimmed;
  }
  return `${trimmed.slice(0, 89)}...`;
}
