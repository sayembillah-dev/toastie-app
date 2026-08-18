/** Toastmasters evaluation-form PDFs, keyed by exact catalog project
 * name (`pathway-catalog.json`). Source: the official evaluation resources
 * on toastmasterscdn (English set). Projects with no dedicated form — the
 * "serve as evaluator" leg of Evaluation and Feedback, legacy aliases —
 * are deliberately absent and simply render no download button. */
const EVALUATION_FORM_URLS: Record<string, string> = {
  'Active Listening':
    'https://toastmasterscdn.azureedge.net/medias/files/department-documents/education-documents/evaluation-resources/english/8200e-evaluation-resource-ffe.pdf',
  'Building a Social Media Presence':
    'https://toastmasterscdn.azureedge.net/medias/files/department-documents/education-documents/evaluation-resources/english/8400e-evaluation-resource-ffe.pdf',
  'Communicate Change':
    'https://toastmasterscdn.azureedge.net/medias/files/department-documents/education-documents/evaluation-resources/english/8401e-evaluation-resource-ffe.pdf',
  'Connect with Storytelling':
    'https://toastmasterscdn.azureedge.net/medias/files/department-documents/education-documents/evaluation-resources/english/8300e-evaluation-resource-ffe.pdf',
  'Connect with Your Audience':
    'https://toastmasterscdn.azureedge.net/medias/files/department-documents/education-documents/evaluation-resources/english/8201e-evaluation-resource-ffe.pdf',
  'Create a Podcast':
    'https://toastmasterscdn.azureedge.net/medias/files/department-documents/education-documents/evaluation-resources/english/8402e-evaluation-resource-ffe.pdf',
  'Creating Effective Visual Aids':
    'https://toastmasterscdn.azureedge.net/medias/files/department-documents/education-documents/evaluation-resources/english/8301e-evaluation-resource-ffe.pdf',
  'Cross-Cultural Understanding':
    'https://toastmasterscdn.azureedge.net/medias/files/department-documents/education-documents/evaluation-resources/english/8202e-evaluation-resource-ffe.pdf',
  'Deliver Social Speeches':
    'https://toastmasterscdn.azureedge.net/medias/files/department-documents/education-documents/evaluation-resources/english/8302e-evaluation-resource-ffe.pdf',
  'Develop Your Vision':
    'https://toastmasterscdn.azureedge.net/medias/files/department-documents/education-documents/evaluation-resources/english/8501e-evaluation-resource-ffe.pdf',
  'Develop a Communication Plan':
    'https://toastmasterscdn.azureedge.net/medias/files/department-documents/education-documents/evaluation-resources/english/8303e-evaluation-resource-ffe.pdf',
  'Effective Body Language':
    'https://toastmasterscdn.azureedge.net/medias/files/department-documents/education-documents/evaluation-resources/english/8203e-evaluation-resource-ffe.pdf',
  'Engage Your Audience with Humor':
    'https://toastmasterscdn.azureedge.net/medias/files/department-documents/education-documents/evaluation-resources/english/8320e-evaluation-resource-ffe.pdf',
  'Ethical Leadership':
    'https://toastmasterscdn.azureedge.net/medias/files/department-documents/education-documents/evaluation-resources/english/8502e-evaluation-resource-ffe.pdf',
  'Evaluation and Feedback (First Speech)':
    'https://toastmasterscdn.azureedge.net/medias/files/department-documents/education-documents/evaluation-resources/english/8100e1-evaluation-resource-first-speech-ffe.pdf',
  'Evaluation and Feedback (Second Speech with Feedback Applied)':
    'https://toastmasterscdn.azureedge.net/medias/files/department-documents/education-documents/evaluation-resources/english/8100e2-evaluation-resource-second-speech.pdf',
  'Evaluation and Feedback (Second Speech)':
    'https://toastmasterscdn.azureedge.net/medias/files/department-documents/education-documents/evaluation-resources/english/8100e2-evaluation-resource-second-speech.pdf',
  'Focus on the Positive':
    'https://toastmasterscdn.azureedge.net/medias/files/department-documents/education-documents/evaluation-resources/english/8304e-evaluation-resource-ffe.pdf',
  'High Performance Leadership':
    'https://toastmasterscdn.azureedge.net/medias/files/department-documents/education-documents/evaluation-resources/english/8503e-evaluation-resource-ffe.pdf',
  'Ice Breaker':
    'https://toastmasterscdn.azureedge.net/medias/files/department-documents/education-documents/evaluation-resources/english/8101e-evaluation-resource-ffe.pdf',
  'Improvement Through Coaching':
    'https://toastmasterscdn.azureedge.net/medias/files/department-documents/education-documents/evaluation-resources/english/8403e-evaluation-resource-ffe.pdf',
  'Inspire Your Audience':
    'https://toastmasterscdn.azureedge.net/medias/files/department-documents/education-documents/evaluation-resources/english/8305e-evaluation-resource-ffe.pdf',
  'Introduction to Toastmasters Mentoring':
    'https://toastmasterscdn.azureedge.net/medias/files/department-documents/education-documents/evaluation-resources/english/8204e-evaluation-resource-ffe.pdf',
  'Introduction to Vocal Variety and Body Language':
    'https://toastmasterscdn.azureedge.net/medias/files/department-documents/education-documents/evaluation-resources/english/8104e1-evaluation-resource-r.pdf',
  'Know Your Sense of Humor':
    'https://toastmasterscdn.azureedge.net/medias/files/department-documents/education-documents/evaluation-resources/english/8208e-evaluation-resource-ffe.pdf',
  'Lead in Any Situation':
    'https://toastmasterscdn.azureedge.net/medias/files/department-documents/education-documents/evaluation-resources/english/8504e-evaluation-resource-ffe.pdf',
  'Leading Your Team':
    'https://toastmasterscdn.azureedge.net/medias/files/department-documents/education-documents/evaluation-resources/english/8405e-evaluation-resource-ffe.pdf',
  'Leading in Difficult Situations':
    'https://toastmasterscdn.azureedge.net/medias/files/department-documents/education-documents/evaluation-resources/english/8404e-evaluation-resource-ffe.pdf',
  'Leading in Your Volunteer Organization':
    'https://toastmasterscdn.azureedge.net/medias/files/department-documents/education-documents/evaluation-resources/english/8505e-evaluation-resource-ffe.pdf',
  'Lessons Learned':
    'https://toastmasterscdn.azureedge.net/medias/files/department-documents/education-documents/evaluation-resources/english/8506e-evaluation-resource-ffe.pdf',
  'Make Connections Through Networking':
    'https://toastmasterscdn.azureedge.net/medias/files/department-documents/education-documents/evaluation-resources/english/8306e-evaluation-resource-ffe.pdf',
  'Manage Change':
    'https://toastmasterscdn.azureedge.net/medias/files/department-documents/education-documents/evaluation-resources/english/8406e-evaluation-resource-ffe.pdf',
  'Manage Online Meetings':
    'https://toastmasterscdn.azureedge.net/medias/files/department-documents/education-documents/evaluation-resources/english/8407e-evaluation-resource-ffe.pdf',
  'Manage Projects Successfully':
    'https://toastmasterscdn.azureedge.net/medias/files/department-documents/education-documents/evaluation-resources/english/8408e-evaluation-resource-ffe.pdf',
  'Manage Successful Events':
    'https://toastmasterscdn.azureedge.net/medias/files/department-documents/education-documents/evaluation-resources/english/8507e-evaluation-resource-ffe.pdf',
  'Managing Time':
    'https://toastmasterscdn.azureedge.net/medias/files/department-documents/education-documents/evaluation-resources/english/8205e-evaluation-resource-ffe.pdf',
  'Managing a Difficult Audience':
    'https://toastmasterscdn.azureedge.net/medias/files/department-documents/education-documents/evaluation-resources/english/8409e-evaluation-resource-ffe.pdf',
  'Moderate a Panel Discussion':
    'https://toastmasterscdn.azureedge.net/medias/files/department-documents/education-documents/evaluation-resources/english/8508e-evaluation-resource-ffe.pdf',
  'Motivate Others':
    'https://toastmasterscdn.azureedge.net/medias/files/department-documents/education-documents/evaluation-resources/english/8411e-evaluation-resource-ffe.pdf',
  'Negotiate the Best Outcome':
    'https://toastmasterscdn.azureedge.net/medias/files/department-documents/education-documents/evaluation-resources/english/8307e-evaluation-resource-ffe.pdf',
  'Persuasive Speaking':
    'https://toastmasterscdn.azureedge.net/medias/files/department-documents/education-documents/evaluation-resources/english/8308e-evaluation-resource-ffe.pdf',
  'Planning and Implementing':
    'https://toastmasterscdn.azureedge.net/medias/files/department-documents/education-documents/evaluation-resources/english/8309e-evaluation-resource-ffe.pdf',
  'Prepare for an Interview':
    'https://toastmasterscdn.azureedge.net/medias/files/department-documents/education-documents/evaluation-resources/english/8310e-evaluation-resource-ffe.pdf',
  'Prepare to Speak Professionally':
    'https://toastmasterscdn.azureedge.net/medias/files/department-documents/education-documents/evaluation-resources/english/8509e-evaluation-resource-ffe.pdf',
  'Present a Proposal':
    'https://toastmasterscdn.azureedge.net/medias/files/department-documents/education-documents/evaluation-resources/english/8312e-evaluation-resource-ffe.pdf',
  'Public Relations Strategies':
    'https://toastmasterscdn.azureedge.net/medias/files/department-documents/education-documents/evaluation-resources/english/8412e-evaluation-resource-ffe.pdf',
  'Question-and-Answer Session':
    'https://toastmasterscdn.azureedge.net/medias/files/department-documents/education-documents/evaluation-resources/english/8413e-evaluation-resource-ffe.pdf',
  'Reaching Consensus':
    'https://toastmasterscdn.azureedge.net/medias/files/department-documents/education-documents/evaluation-resources/english/8313e-evaluation-resource-ffe.pdf',
  'Reflect on Your Path':
    'https://toastmasterscdn.azureedge.net/medias/files/department-documents/education-documents/evaluation-resources/english/8510e-evaluation-resource-ffe.pdf',
  'Researching and Presenting':
    'https://toastmasterscdn.azureedge.net/medias/files/department-documents/education-documents/evaluation-resources/english/8321e-evaluation-resource.pdf',
  'Successful Collaboration':
    'https://toastmasterscdn.azureedge.net/medias/files/department-documents/education-documents/evaluation-resources/english/8314e-evaluation-resource-ffe.pdf',
  'Team Building':
    'https://toastmasterscdn.azureedge.net/medias/files/department-documents/education-documents/evaluation-resources/english/8511e-evaluation-resource-ffe.pdf',
  'Understanding Conflict Resolution':
    'https://toastmasterscdn.azureedge.net/medias/files/department-documents/education-documents/evaluation-resources/english/8315e-evaluation-resource-ffe.pdf',
  'Understanding Emotional Intelligence':
    'https://toastmasterscdn.azureedge.net/medias/files/department-documents/education-documents/evaluation-resources/english/8316e-evaluation-resource-ffe.pdf',
  'Understanding Vocal Variety':
    'https://toastmasterscdn.azureedge.net/medias/files/department-documents/education-documents/evaluation-resources/english/8317e-evaluation-resource-ffe.pdf',
  'Understanding Your Communication Style':
    'https://toastmasterscdn.azureedge.net/medias/files/department-documents/education-documents/evaluation-resources/english/8206e-evaluation-resource-ffe.pdf',
  'Understanding Your Leadership Style':
    'https://toastmasterscdn.azureedge.net/medias/files/department-documents/education-documents/evaluation-resources/english/8207e-evaluation-resource-ffe.pdf',
  'Using Descriptive Language':
    'https://toastmasterscdn.azureedge.net/medias/files/department-documents/education-documents/evaluation-resources/english/8318e-evaluation-resource-ffe.pdf',
  'Using Presentation Software':
    'https://toastmasterscdn.azureedge.net/medias/files/department-documents/education-documents/evaluation-resources/english/8319e-evaluation-resource-ffe.pdf',
  'Write a Compelling Blog':
    'https://toastmasterscdn.azureedge.net/medias/files/department-documents/education-documents/evaluation-resources/english/8414e-evaluation-resource-ffe.pdf',
  'Writing a Speech with Purpose':
    'https://toastmasterscdn.azureedge.net/medias/files/department-documents/education-documents/evaluation-resources/english/8103e-evaluation-resource-ff.pdf',
};

export function getEvaluationFormUrl(projectName: string): string | undefined {
  return EVALUATION_FORM_URLS[projectName];
}

/** Downloads a project's evaluation form. Cross-origin CDN links ignore the
 * anchor `download` attribute, so PDFs are fetched into a blob and saved
 * under the CDN's own filename; any failure (CORS, network) falls back to
 * opening the file in a new tab — which is also where non-PDF links go
 * straight away. */
export async function downloadEvaluationForm(url: string): Promise<void> {
  if (!url.toLowerCase().endsWith('.pdf')) {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = url.split('/').pop() ?? 'evaluation-form.pdf';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
  } catch {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}
