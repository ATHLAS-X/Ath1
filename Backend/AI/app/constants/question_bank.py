"""Cricket Development Profile question bank — Engineering Doc Section 4.3.

A static, importable data structure so the frontend or test suite can request the
full instrument. Contains:
  * 28 ACSI-28 items across 7 subscales (items 27 & 28 reverse-scored),
  * 5 lie-scale items (L1-L5),
  * 10 behavioural-anchoring scenarios (4 options each),
  * 5 open-ended reflection questions.

Pre-processing (subscale aggregation, reverse scoring, flag detection) lives in
``app/services/preprocessing.py`` and consumes the SUBSCALES / interpretation bands
defined here. See Engineering Doc Section 4.4.
"""

from __future__ import annotations

from typing import TypedDict

# ── Response scale (Section A) ───────────────────────────────────────────────
RESPONSE_SCALE: dict[int, str] = {
    1: "Almost Never",
    2: "Sometimes",
    3: "Often",
    4: "Almost Always",
}

INSTRUCTIONS_TO_PLAYER: str = (
    "This Cricket Development Profile helps coaches understand how you approach the "
    "mental side of the game. There are no right or wrong answers. Answer based on "
    "what you ACTUALLY do, not what you think coaches want to hear. Your honest "
    "responses will generate the most useful feedback for your development. This "
    "profile takes about 15 minutes to complete."
)


class ACSIItem(TypedDict):
    number: int
    text: str
    subscale: str
    reverse_scored: bool


# ── 28 ACSI items (item numbers 1-28, in subscale order) ─────────────────────
ACSI_ITEMS: list[ACSIItem] = [
    # Coping with Adversity (1-6)
    {"number": 1, "subscale": "coping_with_adversity", "reverse_scored": False,
     "text": "When I get bowled out cheaply, I am able to forget about it and focus on the next innings."},
    {"number": 2, "subscale": "coping_with_adversity", "reverse_scored": False,
     "text": "I can regain my composure after a bowler has beaten my bat several times in a row."},
    {"number": 3, "subscale": "coping_with_adversity", "reverse_scored": False,
     "text": "When my team is losing badly, I can push negative thoughts out of my mind and keep trying."},
    {"number": 4, "subscale": "coping_with_adversity", "reverse_scored": False,
     "text": "I am able to come back strongly in a match after something has gone wrong for me."},
    {"number": 5, "subscale": "coping_with_adversity", "reverse_scored": False,
     "text": "When I drop a catch or make a fielding error, I let it go quickly and stay focused."},
    {"number": 6, "subscale": "coping_with_adversity", "reverse_scored": False,
     "text": "I can handle the frustration of being unable to score runs during a difficult spell of bowling."},
    # Peaking Under Pressure (7-10)
    {"number": 7, "subscale": "peaking_under_pressure", "reverse_scored": False,
     "text": "I perform my best when the match is on the line (final over, close chase, final day of a Ranji match)."},
    {"number": 8, "subscale": "peaking_under_pressure", "reverse_scored": False,
     "text": "The more pressure there is in a match, the more I enjoy the challenge."},
    {"number": 9, "subscale": "peaking_under_pressure", "reverse_scored": False,
     "text": "I rise to the occasion when my team really needs me to perform."},
    {"number": 10, "subscale": "peaking_under_pressure", "reverse_scored": False,
     "text": "I stay calm and execute my skills well in high-pressure situations."},
    # Goal Setting / Mental Preparation (11-14)
    {"number": 11, "subscale": "goal_setting", "reverse_scored": False,
     "text": "Before a match, I have a clear plan for what I want to achieve in my batting or bowling."},
    {"number": 12, "subscale": "goal_setting", "reverse_scored": False,
     "text": "I set specific, measurable goals for my cricket improvement (e.g., “I want to improve my strike rate against spin this season”)."},
    {"number": 13, "subscale": "goal_setting", "reverse_scored": False,
     "text": "I mentally rehearse my shots or bowling action before going out to play."},
    {"number": 14, "subscale": "goal_setting", "reverse_scored": False,
     "text": "I review my performance after matches and identify what I need to work on."},
    # Concentration (15-18)
    {"number": 15, "subscale": "concentration", "reverse_scored": False,
     "text": "I can maintain focus for long periods without getting distracted (e.g., through a full day of batting)."},
    {"number": 16, "subscale": "concentration", "reverse_scored": False,
     "text": "It is easy for me to keep my mind on my game during boring or low-intensity phases of a match."},
    {"number": 17, "subscale": "concentration", "reverse_scored": False,
     "text": "I catch myself early when my mind starts to wander during a match, and I bring it back."},
    {"number": 18, "subscale": "concentration", "reverse_scored": False,
     "text": "I can block out crowd noise, opposition sledging, and other distractions when I am playing."},
    # Confidence and Achievement Motivation (19-22)
    {"number": 19, "subscale": "confidence", "reverse_scored": False,
     "text": "I believe I can perform well against bowlers (or batsmen) who are better than me on paper."},
    {"number": 20, "subscale": "confidence", "reverse_scored": False,
     "text": "I am confident in my ability to move up to the next level in cricket (e.g., from district to state selection)."},
    {"number": 21, "subscale": "confidence", "reverse_scored": False,
     "text": "I am motivated to train and improve even when no one is watching or checking on me."},
    {"number": 22, "subscale": "confidence", "reverse_scored": False,
     "text": "I set high standards for myself and am disappointed when I do not meet them."},
    # Coachability (23-26)
    {"number": 23, "subscale": "coachability", "reverse_scored": False,
     "text": "When my coach gives me technical advice, I am eager to try it even if it feels uncomfortable at first."},
    {"number": 24, "subscale": "coachability", "reverse_scored": False,
     "text": "I actively seek feedback from coaches and senior players about my game."},
    {"number": 25, "subscale": "coachability", "reverse_scored": False,
     "text": "When a coach points out a flaw in my technique, I see it as an opportunity to improve rather than criticism."},
    {"number": 26, "subscale": "coachability", "reverse_scored": False,
     "text": "I am willing to change my approach or technique if my coach believes it will help me perform better."},
    # Freedom from Worry (27-28, reverse scored)
    {"number": 27, "subscale": "freedom_from_worry", "reverse_scored": True,
     "text": "I worry about letting my team down when I am about to bat or bowl."},
    {"number": 28, "subscale": "freedom_from_worry", "reverse_scored": True,
     "text": "I get nervous about my place in the team being at risk if I fail in a match."},
]


class SubscaleDef(TypedDict):
    name: str
    item_numbers: list[int]
    min_score: int
    max_score: int
    # interpretation bands: inclusive (low_max, moderate_max) -> see Section 4.5 table
    low_max: int
    moderate_max: int


# ── 7 subscales: item membership + score ranges + interpretation bands ───────
# Section 4.4 (aggregation/ranges) + Section 4.5 (low/moderate/high bands).
SUBSCALES: dict[str, SubscaleDef] = {
    "coping_with_adversity": {"name": "Coping with Adversity", "item_numbers": [1, 2, 3, 4, 5, 6],
                              "min_score": 6, "max_score": 24, "low_max": 12, "moderate_max": 18},
    "peaking_under_pressure": {"name": "Peaking Under Pressure", "item_numbers": [7, 8, 9, 10],
                               "min_score": 4, "max_score": 16, "low_max": 8, "moderate_max": 12},
    "goal_setting": {"name": "Goal Setting/Mental Preparation", "item_numbers": [11, 12, 13, 14],
                     "min_score": 4, "max_score": 16, "low_max": 8, "moderate_max": 12},
    "concentration": {"name": "Concentration", "item_numbers": [15, 16, 17, 18],
                      "min_score": 4, "max_score": 16, "low_max": 8, "moderate_max": 12},
    "confidence": {"name": "Confidence and Achievement Motivation", "item_numbers": [19, 20, 21, 22],
                   "min_score": 4, "max_score": 16, "low_max": 8, "moderate_max": 12},
    "coachability": {"name": "Coachability", "item_numbers": [23, 24, 25, 26],
                     "min_score": 4, "max_score": 16, "low_max": 8, "moderate_max": 12},
    "freedom_from_worry": {"name": "Freedom from Worry", "item_numbers": [27, 28],
                           "min_score": 2, "max_score": 8, "low_max": 4, "moderate_max": 6},
}

REVERSE_SCORED_ITEMS: list[int] = [27, 28]
TOTAL_ACSI_MIN = 28
TOTAL_ACSI_MAX = 112


# ── Lie scale (Section D) — embedded in Section A; delivered as a 5-int array ─
class LieScaleItem(TypedDict):
    id: str
    text: str


LIE_SCALE_ITEMS: list[LieScaleItem] = [
    {"id": "L1", "text": "I never feel nervous before any match, ever."},
    {"id": "L2", "text": "I always perform at my best in every single match I play."},
    {"id": "L3", "text": "I never argue with umpires, teammates, or coaches, no matter what happens."},
    {"id": "L4", "text": "When I make a mistake on the field, I forget about it immediately and it never bothers me."},
    {"id": "L5", "text": "I enjoy every aspect of cricket training, even the boring fitness work, every single session."},
]
# "Almost Always" (4) on >= this many lie items triggers the lie_scale_triggered flag.
LIE_SCALE_TRIGGER_THRESHOLD = 2
LIE_SCALE_ALMOST_ALWAYS = 4


# ── Behavioural-anchoring scenarios (Section B) — 10 scenarios, 4 options ─────
class Scenario(TypedDict):
    id: str
    title: str
    prompt: str
    options: dict[str, str]


SCENARIOS: list[Scenario] = [
    {"id": "scenario_1", "title": "Being Dropped from the Team",
     "prompt": ("You have been dropped from the playing XI after three consecutive low scores. "
                "The selector tells you your technique looks fine but you are not converting starts. "
                "What do you do?"),
     "options": {
         "A": "I would ask my coach for specific feedback on what to work on, then create a practice plan to address it.",
         "B": "I would feel disappointed but trust that the selectors know best and keep working hard in the nets.",
         "C": "I would feel angry and frustrated, probably complain to teammates about the decision.",
         "D": "I would lose confidence and start doubting whether I am good enough for this level.",
     }},
    {"id": "scenario_2", "title": "Batting Collapse Context",
     "prompt": ("Your team has lost 5 wickets for 30 runs. You are the new batsman at the crease, and "
                "the opposition bowler is on a hat-trick. What is your first thought?"),
     "options": {
         "A": "“This is my chance to show character and rescue the innings.”",
         "B": "“I need to survive this over and then build a partnership slowly.”",
         "C": "“I hope I don’t get out first ball and make things worse.”",
         "D": "“The pitch is doing something — I just need to weather the storm.”",
     }},
    {"id": "scenario_3", "title": "Hostile Crowd or Sledging",
     "prompt": ("The opposition players are sledging you continuously, and a section of the crowd is "
                "shouting personal comments. You are batting on 40 and have just played and missed. "
                "What do you do?"),
     "options": {
         "A": "I use it as motivation and focus even harder on the next ball.",
         "B": "I ignore it completely and stick to my process.",
         "C": "I might say something back if it crosses a line.",
         "D": "I find it distracting and my concentration starts to slip.",
     }},
    {"id": "scenario_4", "title": "Losing Form Over Multiple Matches",
     "prompt": ("You have scored below 20 in your last 6 innings. Nothing feels wrong technically, but "
                "the runs are not coming. How do you approach this?"),
     "options": {
         "A": "I talk to my coach, analyze what is different, and make a specific adjustment.",
         "B": "I keep believing in my process and know the runs will come if I stay patient.",
         "C": "I start trying different things in the nets — maybe something will click.",
         "D": "I start feeling stressed about my form and it affects my confidence.",
     }},
    {"id": "scenario_5", "title": "Disagreement with Coach",
     "prompt": ("Your coach wants you to change your batting stance to be more side-on. You have been "
                "successful with your current stance and do not think it needs changing. What do you do?"),
     "options": {
         "A": "I try the coach’s suggestion with an open mind, even if I am skeptical.",
         "B": "I explain my concerns to the coach and ask for a compromise.",
         "C": "I nod along but keep doing what works for me.",
         "D": "I get defensive and argue that my way is better.",
     }},
    {"id": "scenario_6", "title": "Injury Recovery",
     "prompt": ("You have been out for 6 weeks with a side strain. You are cleared to return but have "
                "not bowled at match intensity. Your captain asks you to bowl in a crucial match. What "
                "do you say?"),
     "options": {
         "A": "“I am ready. I have done my rehab and I am confident my body can handle it.”",
         "B": "“I will bowl but let me know if my action looks different or I am struggling.”",
         "C": "“Can I bowl a few overs and see how it feels?”",
         "D": "“I am worried about re-injuring myself — maybe someone else should bowl.”",
     }},
    {"id": "scenario_7", "title": "Death Bowling Under Pressure",
     "prompt": ("You are the designated death bowler. The opposition needs 12 runs off the last over. "
                "Your captain throws you the ball. What is going through your mind?"),
     "options": {
         "A": "“I have practiced for this moment. Stick to my plans and execute.”",
         "B": "“I will focus on one ball at a time and not think about the outcome.”",
         "C": "“I hope I don’t bowl a bad ball and cost us the match.”",
         "D": "“The pressure is on them — I just need to bowl straight and let them make mistakes.”",
     }},
    {"id": "scenario_8", "title": "Opening the Innings",
     "prompt": ("You are an opening batsman facing the first ball of a Ranji Trophy match. The bowler is "
                "a 140kph+ quick who has just taken two wickets in the previous over. How do you feel "
                "walking out?"),
     "options": {
         "A": "Excited and ready for the challenge — this is why I play cricket.",
         "B": "Calm and focused — I trust my preparation and my game plan.",
         "C": "Nervous but trying not to show it.",
         "D": "Anxious — I just want to survive the first few overs.",
     }},
    {"id": "scenario_9", "title": "Team Leadership Moment",
     "prompt": ("You are a senior player and notice a younger teammate is struggling with confidence "
                "after a string of failures. During a break in play, what do you do?"),
     "options": {
         "A": "I go over and offer specific encouragement based on what I have seen in the nets.",
         "B": "I give them space — they need to figure it out themselves.",
         "C": "I tell them to relax and not take it too seriously.",
         "D": "I do not know what to say, so I avoid the situation.",
     }},
    {"id": "scenario_10", "title": "Adaptation to Conditions",
     "prompt": ("You arrive at the ground and see a green, seaming pitch. You are a batsman who prefers "
                "flat, batting-friendly tracks. What is your mental approach?"),
     "options": {
         "A": "I adjust my game plan immediately — shorter backlift, tighter technique, patience.",
         "B": "I remind myself that runs on a tough pitch are more valuable and back my defense.",
         "C": "I hope the pitch settles down as the day goes on.",
         "D": "I start worrying that I am going to struggle and get out cheaply.",
     }},
]

# Used by the response-inconsistency check (Section 4.4): high Coachability + Scenario 5 C/D.
INCONSISTENCY_SCENARIO_ID = "scenario_5"
INCONSISTENCY_SCENARIO_OPTIONS = {"C", "D"}


# ── Open-ended reflection (Section C) — 5 questions ──────────────────────────
class OpenEndedQuestion(TypedDict):
    id: str
    text: str
    min_words: int


OPEN_ENDED_QUESTIONS: list[OpenEndedQuestion] = [
    {"id": "q1", "min_words": 50,
     "text": "Describe the worst day you have had in cricket. What happened, and what did you do the next morning?"},
    {"id": "q2", "min_words": 50,
     "text": "Tell me about a time when you disagreed with your coach’s decision about your game. What did you do, and what was the outcome?"},
    {"id": "q3", "min_words": 50,
     "text": "When have you played your best cricket? What was going on in your life at that time — not just in cricket, but outside of it too?"},
    {"id": "q4", "min_words": 50,
     "text": "Imagine you are mentoring a 15-year-old cricketer who just got dropped from their district team. They are talented but mentally fragile. What specific advice would you give them?"},
    {"id": "q5", "min_words": 50,
     "text": "What is the one aspect of your mental game that you know holds you back, and what have you actually done (not just thought about) to address it?"},
]

# The vagueness pre-processing flag (Section 4.4) uses a 30-word threshold (distinct
# from the 50-word display minimum shown to players above).
OPEN_ENDED_VAGUENESS_WORD_THRESHOLD = 30
