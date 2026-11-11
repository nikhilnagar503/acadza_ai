import json
import os
import re
from collections import defaultdict
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
with open(os.path.join(BASE_DIR, 'data/questions.json'), 'r') as f:
    questions = {q['_id']: q for q in json.load(f)}

with open(os.path.join(BASE_DIR, 'data/reports.json'), 'r') as f:
    reports = json.load(f)

with open(os.path.join(BASE_DIR, 'results.json'), 'r') as f:
    results_by_rid = {r['reportId']: r for r in json.load(f)}

with open(os.path.join(BASE_DIR, 'data/taxonomy.json'), 'r') as f:
    taxonomy = json.load(f)

def clean_production_html(html_str):
    if not html_str:
        return ""
    # Strip hardcoded black text styles from production edtech HTML
    cleaned = re.sub(r'style=[\"\'][^\"\']*color\s*:\s*(#000000|#000|black|rgb\(0,\s*0,\s*0\))[^\"\']*[\"\']', '', html_str, flags=re.IGNORECASE)
    cleaned = re.sub(r'style=[\"\']color:#000000[\"\']', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'style=[\"\']true[\"\']', '', cleaned)
    cleaned = re.sub(r'color\s*:\s*#000000;?', '', cleaned, flags=re.IGNORECASE)
    return cleaned

# Group reports by questionId
q_reports = defaultdict(list)
for r in reports:
    rid = r['reportId']
    r_item = dict(r)
    r_item['triage'] = results_by_rid.get(rid, {})
    q_reports[r['questionId']].append(r_item)

# Build question groups
groups = []
severity_weights = {
    'answer_key': 40,
    'stem_data': 35,
    'option_repair': 30,
    'diagram': 30,
    'identical_options': 25,
    'wrong_chapter': 25,
    'syllabus': 25,
    'solution_fix': 20,
    'type_mismatch': 20,
    'markup_leak': 15,
    'answer_form': 10,
    'spelling': 10,
    'exam_reference': 10
}

for qid, reps in q_reports.items():
    q = questions.get(qid, {})
    qtype = q.get('questionType', 'scq')
    q_data = q.get(qtype, {})
    
    report_count = len(reps)
    latest_rep_time = max(r['reportedAt'] for r in reps)
    
    verdicts = [r['triage'].get('verdict') for r in reps]
    repairs = [r['triage'].get('repair') for r in reps if r['triage'].get('repair')]
    routes = [r['triage'].get('route') for r in reps]
    
    has_faculty_review = 'faculty_review' in routes
    has_auto_apply = 'auto_apply' in routes
    primary_route = 'faculty_review' if has_faculty_review else ('auto_apply' if has_auto_apply else 'no_change')
    
    primary_repair = repairs[0] if repairs else None
    primary_verdict = 'defect' if 'defect' in verdicts else verdicts[0]
    
    urgency_score = 0
    urgency_reasons = []
    
    if report_count > 1:
        urgency_score += report_count * 50
        urgency_reasons.append(f"{report_count} students reported this question")
    else:
        urgency_score += 20
        
    if has_faculty_review:
        urgency_score += 45
        urgency_reasons.append(f"Requires human faculty approval ({primary_repair})")
        
    if primary_repair:
        sev = severity_weights.get(primary_repair, 10)
        urgency_score += sev
        if primary_repair == 'answer_key':
            urgency_reasons.append("Answer key error causes immediate unfair score penalty")
        elif primary_repair in ['stem_data', 'option_repair', 'diagram']:
            urgency_reasons.append("Question is unsolvable in current state")
    elif primary_verdict == 'no_error':
        urgency_score += 5
        urgency_reasons.append("Student confusion on valid question")
    else:
        urgency_score += 5
        urgency_reasons.append(f"{primary_verdict.replace('_', ' ').capitalize()}")

    edits = [r['triage'].get('edit') for r in reps if r['triage'].get('edit')]
    proposed_edit = edits[0] if edits else None
    
    diff_data = None
    if proposed_edit:
        target_field = proposed_edit['field']
        find_val = proposed_edit['find']
        replace_val = proposed_edit['replace']
        original_val = q_data.get(target_field, '')
        
        diff_data = {
            'field': target_field,
            'find': find_val,
            'replace': replace_val,
            'original_sample': original_val if target_field == 'answer' else find_val,
            'proposed_sample': replace_val
        }
    
    primary_evidence = reps[0]['triage'].get('evidence', '')
    primary_reply = reps[0]['triage'].get('student_reply', '')
    avg_confidence = sum(r['triage'].get('confidence', 0.9) for r in reps) / len(reps)
    
    group_item = {
        'questionId': qid,
        'subject': q.get('subject', 'Unknown'),
        'chapter': q.get('chapter', 'General'),
        'level': q.get('level', 'MEDIUM'),
        'questionType': qtype,
        'originalAnswer': q_data.get('answer', ''),
        'questionHtml': clean_production_html(q_data.get('question', '')),
        'solutionHtml': clean_production_html(q_data.get('solution', '')),
        'reports': reps,
        'reportCount': report_count,
        'latestReportedAt': latest_rep_time,
        'primaryVerdict': primary_verdict,
        'primaryRepair': primary_repair,
        'primaryRoute': primary_route,
        'urgencyScore': urgency_score,
        'urgencyReasons': urgency_reasons,
        'confidence': round(avg_confidence, 2),
        'evidence': primary_evidence,
        'studentReply': primary_reply,
        'diff': diff_data,
        'errorHistory': q.get('errorHistory', [])
    }
    groups.append(group_item)

groups.sort(key=lambda g: (g['urgencyScore'], g['latestReportedAt']), reverse=True)

for i, g in enumerate(groups):
    g['urgencyRank'] = i + 1

reported_qids = set(q_reports.keys())
unreported_bonus = []
for qid, q in questions.items():
    if qid not in reported_qids:
        qtype = q.get('questionType', 'scq')
        q_data = q.get(qtype, {})
        
        defect_note = ""
        suggested_repair = ""
        if qid == '68dea657387eea3d0d95f54a':
            defect_note = "Solution contains typographical notation errors in MathML: 'P_{eqcu}' and 'P_{eqch}' instead of 'P_{each}'."
            suggested_repair = "notation / spelling"
        elif qid == '68dea87d387eea3d0d95fbe3':
            defect_note = "Question contains empty MathML exponent tags '<math><msup><mi></mi><mrow><mo>&minus; 1 </mn></mrow></msup></math>' and rogue '<mspace linebreak=\"newline\">' inside option tags."
            suggested_repair = "markup_leak"
        elif qid == '68dea6e6387eea3d0d95f6f8':
            defect_note = "Solution MathML writes 'x^2 = D^2 - 4 D F' with uppercase F instead of lowercase focal length f."
            suggested_repair = "notation"
        else:
            defect_note = "Question has complex multi-statement dialysis logic needing syllabus and distractor verification."
            suggested_repair = "syllabus / verification"
            
        unreported_bonus.append({
            'questionId': qid,
            'subject': q.get('subject'),
            'chapter': q.get('chapter'),
            'level': q.get('level'),
            'questionType': qtype,
            'originalAnswer': q_data.get('answer'),
            'questionHtml': clean_production_html(q_data.get('question', '')),
            'solutionHtml': clean_production_html(q_data.get('solution', '')),
            'defectNote': defect_note,
            'suggestedRepair': suggested_repair
        })

bundle = {
    'stats': {
        'totalReports': len(reports),
        'uniqueQuestions': len(groups),
        'facultyReviewCount': sum(1 for g in groups if g['primaryRoute'] == 'faculty_review'),
        'autoApplyCount': sum(1 for g in groups if g['primaryRoute'] == 'auto_apply'),
        'noChangeCount': sum(1 for g in groups if g['primaryRoute'] == 'no_change'),
        'unreportedBonusCount': len(unreported_bonus)
    },
    'taxonomy': taxonomy,
    'groups': groups,
    'unreportedBonus': unreported_bonus
}

output_js = os.path.join(BASE_DIR, 'console/data.js')
with open(output_js, 'w') as f:
    f.write('window.ACADZA_DATA = ' + json.dumps(bundle, indent=2) + ';\n')

print(f"Generated clean console bundle with {len(groups)} question groups and {len(unreported_bonus)} bonus questions.")
