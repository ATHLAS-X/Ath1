import OnboardingStub from "../_components/OnboardingStub";

export default function ParentOnboarding() {
  return (
    <OnboardingStub
      role="Parent / Guardian"
      title="Link to your player"
      lines={[
        "Your name and relationship to the player",
        "Verify your phone number",
        "Search for your player's account (or invite them)",
        "Sign the guardian consent disclaimer",
      ]}
    />
  );
}
