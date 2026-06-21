"""The 10 synthetic psychology player profiles from Engineering Doc Section 7.2.

Each profile is a complete, valid psychology submission whose ACSI pattern, scenario
selections, and open-ended text match the intent described in the doc. They are used
ONLY by the Tier-3 live prompt-validation tests (tests/test_psych_live.py).

Profiles (with the doc's expected signal):
  1  well-rounded                       — strengths, no flags
  2  high coachability / low confidence — strengths, no flags
  3  overconfident                      — overconfidence risk; cautious scout summary
  4  anxious performer                  — anxiety indicator; cautious scout summary
  5  socially desirable                 — HIGH social-desirability risk
  6  lie-scale triggered                — lie scale triggered + SD risk
  7  inconsistent                       — response inconsistency flag
  8  low engagement                     — low-effort / vagueness flag
  9  strong leader                      — leadership signal, strengths
 10  raw but coachable                  — high potential, strengths
"""

from __future__ import annotations

from app.constants.question_bank import SUBSCALES


def _acsi(values: dict[str, int], default: int = 3) -> dict[int, int]:
    """Build the 28 raw item responses from per-subscale raw values.

    NOTE: for ``freedom_from_worry`` the value is the RAW response to the negatively
    worded items 27/28 (which are reverse-scored downstream), so a HIGH raw value here
    means MORE worry / LOWER freedom-from-worry.
    """
    out: dict[int, int] = {}
    for key, band in SUBSCALES.items():
        v = values.get(key, default)
        for n in band["item_numbers"]:
            out[n] = v
    return out


def _scenarios(overrides: dict[str, str], default: str = "B") -> dict[str, dict]:
    out: dict[str, dict] = {}
    for i in range(1, 11):
        sid = f"scenario_{i}"
        out[sid] = {"selected": overrides.get(sid, default), "other_text": ""}
    return out


def _ctx(role: str = "Batsman", age: int = 20) -> dict:
    return {
        "age": age,
        "primary_role": role,
        "years_playing": 9,
        "competition_level": "District League / U19 National Pathway",
        "state": "Karnataka",
    }


# ── Open-ended text blocks (intent-matched) ──────────────────────────────────
_SPECIFIC = {
    "q1": ("In the Cooch Behar quarterfinal against Mumbai I was bowled for a duck in the "
           "first over playing across the line. The next morning I went to the nets at 6am, "
           "worked with my coach on playing straight, and reviewed the video of my dismissal "
           "for an hour before training."),
    "q2": ("My coach wanted me to bat at number 5 instead of opening. I disagreed but I told "
           "him I would try it for four matches and review the data together. I averaged 40 "
           "in the middle order and admitted he was right about my game suiting that role."),
    "q3": ("I played my best during the U19 state season when my family was settled and I had "
           "a steady training routine. Outside cricket I had finished my exams, so my mind was "
           "free and I could focus fully on batting without other pressures weighing on me."),
    "q4": ("I would tell them that being dropped is feedback, not a verdict. I would help them "
           "build a specific plan — three technical goals and a fitness target — and check in "
           "weekly. I would share how I came back from my own failures by focusing on process."),
    "q5": ("My weakness is concentration in long spells. I have started a focus-reset routine "
           "between balls — touching my bat, taking a breath, watching the bowler's hand — and "
           "I track my dismissals to see when my focus drops. It has reduced my soft dismissals."),
}

_EXTERNALIZING = {
    "q1": ("I got out to a terrible umpiring decision, plumb in front but it was missing leg. "
           "The pitch was also doing too much and the bowlers got lucky. The next day I just "
           "trained normally because there was nothing wrong with how I batted."),
    "q2": ("My coach told me to change my stance but my technique is fine the way it is. I have "
           "scored runs my whole life like this. I kept doing what works for me because I know "
           "my game better than anyone else does."),
    "q3": ("I always play well, honestly. I do not really need special conditions. I am just a "
           "naturally gifted player and the runs come when I want them to."),
    "q4": ("I would tell them not to worry, they are probably just unlucky like I often am. "
           "Selectors make bad calls all the time. They should keep doing what they do."),
    "q5": ("I do not really have a mental weakness. I just need the selectors to give me a fair "
           "run in the side and the runs will come."),
}

_ANXIOUS = {
    "q1": ("My worst day was a final where I froze. I kept thinking about letting everyone down "
           "and my hands were shaking before I batted. I got out cheaply. The next morning I "
           "felt sick about it but I forced myself to go to training and talk to my coach."),
    "q2": ("I disagreed when my coach told me to open because I get very nervous against the new "
           "ball. I explained my anxiety and we agreed I would work on breathing routines. It "
           "helped a little but the nerves are still there in big matches."),
    "q3": ("I played my best in low-pressure friendly matches where nobody was watching and my "
           "place was not at risk. When the stakes are low my mind is calm and I can just play."),
    "q4": ("I would tell them I understand the fear because I feel it too. I would suggest they "
           "talk to someone about the nerves and practice staying in the present moment instead "
           "of worrying about failing like I do."),
    "q5": ("My biggest issue is anxiety before big matches. I have tried deep breathing and "
           "writing down my worries the night before. Some days it helps, but under real "
           "pressure my heart races and I struggle to control it."),
}

_VAGUE = {
    "q1": ("It was a bad day but I stayed positive and worked hard the next day to get better "
           "because I always give my best effort no matter what happens on the field."),
    "q2": ("I always respect my coach and do what is asked. I never really disagree because the "
           "coach knows best and I am always coachable and a good team player at all times."),
    "q3": ("I always play my best cricket every time. My life is always good and positive and I "
           "stay focused and motivated in everything I do on and off the field always."),
    "q4": ("I would tell them to stay positive and work hard and believe in themselves because "
           "hard work always pays off and a positive attitude is the key to success in cricket."),
    "q5": ("I do not really have any weaknesses in my mental game. I am always confident and "
           "focused and positive, and I just keep practising hard to stay at my best always."),
}

_MINIMAL = {
    "q1": "Bad day. Trained next day.",
    "q2": "I just did what coach said.",
    "q3": "When I was playing well.",
    "q4": "Work hard and stay positive.",
    "q5": "Nothing really. Just practice.",
}

_LEADER = {
    "q1": ("After a heavy loss where I was captain, I felt I had let the juniors down. The next "
           "morning I organised an honest team review, owned my tactical mistakes, and set up "
           "extra throwdowns for the two youngsters who had struggled with the short ball."),
    "q2": ("I disagreed with my coach benching a young spinner. I made my case calmly with his "
           "match data, and we agreed to give him one more game in which he took three wickets. "
           "It taught me to back teammates with evidence, not just emotion."),
    "q3": ("My best cricket came when I was made vice-captain and felt responsible for others. "
           "Off the field I was mentoring two academy kids, and that sense of purpose carried "
           "into my own batting — I scored two hundreds that season."),
    "q4": ("I would sit with them and share a specific failure of my own and how I came back. I "
           "would give them one clear technical focus, pair them with a senior in the nets, and "
           "check on them after every session so they never feel alone in it."),
    "q5": ("I can get too involved in others' games and lose focus on my own. I have started "
           "ring-fencing my own preparation time before I take on any leadership role on match "
           "day, and a teammate holds me accountable to it."),
}

_RAW_COACHABLE = {
    "q1": ("My worst day I was hit for five sixes in an over and wanted to quit. The next "
           "morning I honestly did not know what to do, so I asked my coach to watch me bowl "
           "and tell me the truth about my action. He found a problem and we started fixing it."),
    "q2": ("I once disagreed with a field my coach set, but I tried it anyway and it worked. I "
           "realised I still have a lot to learn and that my coach sees things I cannot see yet."),
    "q3": ("I have not played a lot of high-level cricket yet, so my best was a club final. I "
           "was nervous and raw but I listened to every instruction and gave everything I had."),
    "q4": ("I would tell them honestly that I am still learning too. I would say that the only "
           "way up is to ask for help, take feedback without ego, and out-work everyone. That "
           "is the plan I am following myself."),
    "q5": ("My biggest weakness is that my technique is still rough under pressure. I have asked "
           "my coach for a weekly checklist and I film every session so I can see if I am "
           "actually improving and not just hoping I am."),
}


# ── Profile builders ─────────────────────────────────────────────────────────
def profile_1_well_rounded() -> dict:
    return {
        "player_id": "synthetic_1_well_rounded",
        "acsi_responses": _acsi({"coping_with_adversity": 3, "peaking_under_pressure": 3,
                                 "goal_setting": 3, "concentration": 3, "confidence": 3,
                                 "coachability": 3, "freedom_from_worry": 2}),
        "scenario_responses": _scenarios({"scenario_1": "A", "scenario_4": "A", "scenario_9": "A"}),
        "open_ended_responses": _SPECIFIC,
        "lie_scale_responses": [1, 1, 2, 1, 2],
        "player_context": _ctx(),
        "completion_time_minutes": 14,
    }


def profile_2_high_coach_low_confidence() -> dict:
    return {
        "player_id": "synthetic_2_high_coach_low_conf",
        "acsi_responses": _acsi({"coachability": 4, "confidence": 1, "goal_setting": 3,
                                 "coping_with_adversity": 3, "peaking_under_pressure": 2,
                                 "concentration": 3, "freedom_from_worry": 3}),
        "scenario_responses": _scenarios({"scenario_1": "A", "scenario_5": "A", "scenario_4": "A"}),
        "open_ended_responses": _SPECIFIC,
        "lie_scale_responses": [1, 1, 1, 2, 1],
        "player_context": _ctx(),
        "completion_time_minutes": 16,
    }


def profile_3_overconfident() -> dict:
    return {
        "player_id": "synthetic_3_overconfident",
        "acsi_responses": _acsi({"confidence": 4, "coachability": 1, "coping_with_adversity": 3,
                                 "peaking_under_pressure": 3, "goal_setting": 2,
                                 "concentration": 3, "freedom_from_worry": 1}),
        "scenario_responses": _scenarios({"scenario_5": "D", "scenario_1": "C", "scenario_4": "C"}),
        "open_ended_responses": _EXTERNALIZING,
        "lie_scale_responses": [2, 3, 1, 2, 1],
        "player_context": _ctx(),
        "completion_time_minutes": 9,
    }


def profile_4_anxious_performer() -> dict:
    return {
        "player_id": "synthetic_4_anxious",
        "acsi_responses": _acsi({"freedom_from_worry": 4, "coping_with_adversity": 4,
                                 "peaking_under_pressure": 1, "confidence": 2,
                                 "goal_setting": 3, "concentration": 2, "coachability": 3}),
        "scenario_responses": _scenarios({"scenario_7": "C", "scenario_8": "D", "scenario_2": "C"}),
        "open_ended_responses": _ANXIOUS,
        "lie_scale_responses": [1, 1, 1, 1, 1],
        "player_context": _ctx(),
        "completion_time_minutes": 17,
    }


def profile_5_socially_desirable() -> dict:
    return {
        "player_id": "synthetic_5_socially_desirable",
        "acsi_responses": _acsi({}, default=4),  # all max
        "scenario_responses": _scenarios({}, default="A"),  # all the "admirable" option
        "open_ended_responses": _VAGUE,
        "lie_scale_responses": [2, 2, 2, 2, 2],  # not enough to trigger the lie scale
        "player_context": _ctx(),
        "completion_time_minutes": 6,
    }


def profile_6_lie_scale_triggered() -> dict:
    return {
        "player_id": "synthetic_6_lie_triggered",
        "acsi_responses": _acsi({}, default=4),
        "scenario_responses": _scenarios({}, default="A"),
        "open_ended_responses": _VAGUE,
        "lie_scale_responses": [4, 4, 4, 4, 4],  # triggers the lie scale
        "player_context": _ctx(),
        "completion_time_minutes": 5,
    }


def profile_7_inconsistent() -> dict:
    return {
        "player_id": "synthetic_7_inconsistent",
        # High coachability (all 4s) but scenario 5 = D (resists coach) → inconsistency.
        "acsi_responses": _acsi({"coachability": 4, "confidence": 3, "coping_with_adversity": 3,
                                 "peaking_under_pressure": 3, "goal_setting": 3,
                                 "concentration": 3, "freedom_from_worry": 2}),
        "scenario_responses": _scenarios({"scenario_5": "D", "scenario_1": "C"}),
        "open_ended_responses": _EXTERNALIZING,
        "lie_scale_responses": [1, 2, 1, 2, 1],
        "player_context": _ctx(),
        "completion_time_minutes": 11,
    }


def profile_8_low_engagement() -> dict:
    return {
        "player_id": "synthetic_8_low_engagement",
        "acsi_responses": _acsi({}, default=2),
        "scenario_responses": _scenarios({}, default="C"),
        "open_ended_responses": _MINIMAL,  # all well under 30 words
        "lie_scale_responses": [1, 1, 1, 1, 1],
        "player_context": _ctx(),
        "completion_time_minutes": 3,
    }


def profile_9_strong_leader() -> dict:
    return {
        "player_id": "synthetic_9_strong_leader",
        "acsi_responses": _acsi({"confidence": 4, "coachability": 4, "coping_with_adversity": 3,
                                 "peaking_under_pressure": 3, "goal_setting": 3,
                                 "concentration": 3, "freedom_from_worry": 2}),
        "scenario_responses": _scenarios({"scenario_9": "A", "scenario_1": "A", "scenario_5": "A"}),
        "open_ended_responses": _LEADER,
        "lie_scale_responses": [1, 1, 2, 1, 1],
        "player_context": _ctx(role="All-rounder", age=23),
        "completion_time_minutes": 18,
    }


def profile_10_raw_but_coachable() -> dict:
    return {
        "player_id": "synthetic_10_raw_coachable",
        "acsi_responses": _acsi({"coachability": 4, "confidence": 2, "coping_with_adversity": 2,
                                 "peaking_under_pressure": 2, "goal_setting": 2,
                                 "concentration": 2, "freedom_from_worry": 3}),
        "scenario_responses": _scenarios({"scenario_1": "A", "scenario_5": "A", "scenario_4": "A"}),
        "open_ended_responses": _RAW_COACHABLE,
        "lie_scale_responses": [1, 1, 1, 1, 2],
        "player_context": _ctx(role="Fast Bowler", age=17),
        "completion_time_minutes": 15,
    }


ALL_PROFILES = {
    "1_well_rounded": profile_1_well_rounded,
    "2_high_coach_low_confidence": profile_2_high_coach_low_confidence,
    "3_overconfident": profile_3_overconfident,
    "4_anxious_performer": profile_4_anxious_performer,
    "5_socially_desirable": profile_5_socially_desirable,
    "6_lie_scale_triggered": profile_6_lie_scale_triggered,
    "7_inconsistent": profile_7_inconsistent,
    "8_low_engagement": profile_8_low_engagement,
    "9_strong_leader": profile_9_strong_leader,
    "10_raw_but_coachable": profile_10_raw_but_coachable,
}
