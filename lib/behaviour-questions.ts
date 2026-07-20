/**
 * @deprecated This 10-question bank is superseded by the full ACSI-28 instrument
 * served from the compute service (GET /api/v1/compute/psych/questionnaire).
 * The new assessment form at /onboarding/player/assessment fetches questions
 * from the compute service directly.
 *
 * This file is KEPT because it may be referenced by academy forms, coach
 * dashboards, or other non-onboarding flows that haven't been migrated yet.
 * Do NOT delete without checking for other consumers.
 */

export interface BehaviourQuestion {
  id: number;
  prompt: string;
  options: { letter: "A" | "B" | "C" | "D"; text: string }[];
}

export const BEHAVIOUR_QUESTIONS: BehaviourQuestion[] = [
  { id: 1, prompt: "You need 8 runs off 3 balls. A wide is called. Your next ball is…?", options: [
    { letter: "A", text: "Play for the wide" },
    { letter: "B", text: "Go for maximum" },
    { letter: "C", text: "Work it for 2" },
    { letter: "D", text: "Calm down and assess" },
  ]},
  { id: 2, prompt: "Your coach publicly criticises your technique in front of teammates. You…", options: [
    { letter: "A", text: "Argue back" },
    { letter: "B", text: "Accept silently" },
    { letter: "C", text: "Ask for a private discussion later" },
    { letter: "D", text: "Ignore it" },
  ]},
  { id: 3, prompt: "Your team is losing heavily. As opener, you…?", options: [
    { letter: "A", text: "Try to hit out" },
    { letter: "B", text: "Bat time, frustrate bowlers" },
    { letter: "C", text: "Ask captain for guidance" },
    { letter: "D", text: "Protect your average" },
  ]},
  { id: 4, prompt: "A teammate drops a catch off your bowling. You…", options: [
    { letter: "A", text: "Show frustration visibly" },
    { letter: "B", text: "Encourage immediately" },
    { letter: "C", text: "Say nothing" },
    { letter: "D", text: "Ask to be taken off" },
  ]},
  { id: 5, prompt: "You have been dropped from the team. You…", options: [
    { letter: "A", text: "Quit practice" },
    { letter: "B", text: "Train harder" },
    { letter: "C", text: "Talk to selectors" },
    { letter: "D", text: "Join a different team" },
  ]},
  { id: 6, prompt: "In the last over you need 18 to win. You…", options: [
    { letter: "A", text: "Panic" },
    { letter: "B", text: "Calculate required SR" },
    { letter: "C", text: "Just swing hard" },
    { letter: "D", text: "Trust your training" },
  ]},
  { id: 7, prompt: "A new coach changes your batting technique. You…", options: [
    { letter: "A", text: "Resist — it was working" },
    { letter: "B", text: "Try it in nets first" },
    { letter: "C", text: "Implement immediately" },
    { letter: "D", text: "Ask for reasons" },
  ]},
  { id: 8, prompt: "You perform poorly in a high-pressure match. That night you…", options: [
    { letter: "A", text: "Replay mistakes repeatedly" },
    { letter: "B", text: "Analyse and plan" },
    { letter: "C", text: "Sleep it off" },
    { letter: "D", text: "Talk to a teammate" },
  ]},
  { id: 9, prompt: "A bowler is consistently targeting your weakness. You…", options: [
    { letter: "A", text: "Avoid that shot" },
    { letter: "B", text: "Practice it more" },
    { letter: "C", text: "Tell captain to reshuffle" },
    { letter: "D", text: "Accept the battle" },
  ]},
  { id: 10, prompt: "You are asked to bat at an unfamiliar position. You…", options: [
    { letter: "A", text: "Refuse" },
    { letter: "B", text: "Ask why" },
    { letter: "C", text: "Accept and adapt" },
    { letter: "D", text: "Do it reluctantly" },
  ]},
];
