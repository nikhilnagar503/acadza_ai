# PRODUCT THINKING & DESIGN SPEC: Acadza "Report → Fix"

## 1. Who Loses the Most When a Question is Broken?

The biggest loser is **the serious, hardworking aspirant taking a mock test at 11 PM two weeks before JEE/NEET**.

When an answer key is wrong (e.g. Q: 60f744b3 where the true answer is 50 V but key says 130 V), a student who solved it perfectly receives **-1 instead of +4**. In a high-stakes exam where 5 marks shift an all-India rank by 4,000 places, the immediate damage is psychological:
1. **Doubt in their fundamentals**: The student spends 45 minutes re-deriving basic formulas, wondering if their grasp of impedance is flawed.
2. **Erosion of trust in Acadza**: If the platform marks correct work as wrong, students stop trusting their test scores and stop reporting bugs constructively.
3. **Compounding blast radius**: For every hour a defective question stays unpatched, hundreds of other students across coaching batches take that test and face the exact same penalty.

**How our design reflects this:**
* **Answer key defects are assigned top urgency weighting**: Multi-student reports (e.g., Q: 60f744b3 reported by R001, R002, R003) immediately float to the top of the queue.
* **Empathetic, clear student replies**: Instead of a dry system notification, students receive a personal, encouraging reply acknowledging their catch and reaffirming their physics understanding.
* **Surgical automated patching**: Validated `auto_apply` fixes are deployed instantly so no subsequent student suffers the same defect.

---

## 2. What We Would NEVER Let the AI Auto-Apply (And Why)

We will **never** allow the AI to auto-apply changes in four distinct categories:

1. **Distractor Authoring (`identical_options`)**:
   * *Why:* When two options repeat, fabricating a new believable distractor is pedagogical authoring. An AI generating distractors without faculty oversight risks introducing a second valid answer, creating an unsound question.
2. **Missing Diagrams & Visual Assets (`diagram`)**:
   * *Why:* A missing diagram cannot be inferred safely through text alone. An hallucinated graphic could misstate dimensions or coordinate orientations, invalidating the question.
3. **Curricular Boundary Rulings (`syllabus`)**:
   * *Why:* Whether a topic (like cladistics in NEET) is within the latest NTA curriculum is a regulatory and institutional policy decision, not an engineering or LLM judgment.
4. **Broad Semantic Rewrites of Question Stems**:
   * *Why:* AI models love rewording sentences for "fluency". In competitive exams, subtle wording shifts alter technical preconditions (e.g., "smooth horizontal floor" vs "horizontal floor"). All patches must be minimal surgical diffs (`find` / `replace`), never full stem rewrites.

---

## 3. The One Metric We Would Watch in Week 1

**Post-Fix Dispute Rate on Auto-Patches**  
$$\text{Dispute Rate} = \frac{\text{Reports filed on questions within 7 days of an AI auto-patch}}{\text{Total AI auto-applied patches}}$$

* **Why it matters:** Speed of triage is meaningless if our auto-patches introduce secondary defects. If our dispute rate is near $0\%$, faculty can trust the AI and focus their cognitive energy solely on authored repairs. If it exceeds $1.5\%$, our automated confidence thresholds are tightened immediately.

---

## 4. One Idea Beyond This Brief: "Live In-Test Confidence Shield"

Currently, the student experience is completely reactive: a student reports a bug, feels demoralized by a negative score, and waits days for a faculty member to read their ticket.

**The Pitch:**
When an active test-taker clicks *"Report error"* during an exam and types a comment that triggers an AI confidence $> 95\%$ on an `answer_key` or `stem_data` defect (e.g., *"LCR series key says 130 but sqrt(40^2+30^2)=50"*), the system activates a **Live Confidence Shield**:
1. It immediately provisions provisional +4 marks in the student's live scorecard so their test momentum and morale are not shattered.
2. It tags the question across all active exam sessions as *"Under Automated Verification"*.
3. Once faculty verifies the fix with one click on the console, the adjustment is finalized across all batches retroactively.

This converts an error report from a point of frustration into an active moment of student empowerment and brand trust.
