import OnboardingStub from "../_components/OnboardingStub";

export default function TournamentOnboarding() {
  return (
    <OnboardingStub
      role="Tournament Organizer"
      title="Set up your Tournament Profile"
      lines={[
        "Tournament name + format (T20 / ODI / List-A)",
        "Hosting body + registration number",
        "Tournament schedule + venues",
        "Submit for SportX verification — you'll be able to upload scorecards once approved",
      ]}
    />
  );
}
