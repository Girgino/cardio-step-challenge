// Everything a non-programmer might want to edit lives here: names, levels, badges,
// facts, the weekly quiz, the coronary-tree journey and links.

export const SITE = {
  hospital: "HCA Florida Lake Monroe Hospital",
  host: "Cardiology Club",
  url: "https://lmhstepchallenge.github.io/",
  supabaseUrl: "https://ipwnyjsbdpzjjdojyebl.supabase.co",
  publishableKey: "sb_publishable_MP3JHZpE_xYrCRySAYSxww_zy_kvB4J",
  appStore: "https://apps.apple.com/us/app/pacer-pedometer-step-counter/id600446812",
  playStore: "https://play.google.com/store/apps/details?id=cc.pacer.androidapp",
};

// Distances used for "that's like..." conversions (City of Sanford, sanfordfl.gov).
export const PLACES = {
  riverwalkKm: 7.8,   // Sanford RiverWalk, "nearly five miles"
  lakeLoopKm: 41.8,   // loop around Lake Monroe, 26 miles
};

// Identity levels by total steps. Change the numbers freely.
export const LEVELS = [
  { min: 0, name: "Resting", note: "Getting started" },
  { min: 20000, name: "Warm-up", note: "20,000 steps" },
  { min: 75000, name: "Aerobic", note: "75,000 steps" },
  { min: 150000, name: "Tempo", note: "150,000 steps" },
  { min: 250000, name: "Threshold", note: "250,000 steps" },
  { min: 400000, name: "VO₂ max", note: "400,000 steps" },
];
export function levelOf(total) {
  let i = 0;
  while (i + 1 < LEVELS.length && total >= LEVELS[i + 1].min) i++;
  const next = LEVELS[i + 1];
  return { ...LEVELS[i], index: i, next, pct: next ? (total - LEVELS[i].min) / (next.min - LEVELS[i].min) : 1 };
}

// Badge keys come from get_board. Names and descriptions are page-side.
export const BADGES = {
  first_steps: { tag: "1°", name: "First beat", note: "Your first steps counted" },
  k50: { tag: "50K", name: "Atrial kick", note: "50,000 steps" },
  k100: { tag: "SV", name: "Stroke volume", note: "100,000 steps" },
  k250: { tag: "CO", name: "Cardiac output", note: "250,000 steps" },
  k500: { tag: "F-S", name: "Frank–Starling", note: "500,000 steps" },
  m1: { tag: "1M", name: "Million-beat club", note: "1,000,000 steps" },
  marathon: { tag: "42K", name: "Marathon", note: "42.2 km walked in total" },
  day20k: { tag: "20K", name: "Tachycardia", note: "A 20,000-step day" },
  streak7: { tag: "7D", name: "Sinus rhythm", note: "7 days in a row at 7,500+" },
  streak14: { tag: "14D", name: "Steady state", note: "14 days in a row at 7,500+" },
  podium: { tag: "P3", name: "Podium", note: "Top 3 on a single day" },
};
export const BADGE_ORDER = Object.keys(BADGES);

// The collective goal as a walk through the coronary tree. Segments fill in this order,
// each in proportion to its drawn length. Coordinates are in a 400 x 440 box.
export const HEART = {
  outline: "M160 100C118 104 92 140 90 196C88 256 110 316 170 360C214 392 262 410 300 408C330 406 350 380 356 336C362 284 358 222 340 176C322 132 288 104 246 98C216 94 186 96 160 100",
  aorta: "M186 110C182 70 190 38 222 30C254 22 282 36 290 64M214 108C214 86 222 70 240 64",
  segments: [
    { key: "LM", name: "Left main", d: "M206 114C218 120 228 124 240 126", fact: "Short and important: it feeds both the LAD and the circumflex." },
    { key: "LAD", name: "LAD", d: "M240 126C252 170 262 226 272 286C278 324 284 356 292 386", fact: "The widowmaker. Supplies roughly half of the left ventricle." },
    { key: "D1", name: "First diagonal", d: "M253 186C272 198 292 214 308 240", fact: "Diagonals run across the front wall of the left ventricle." },
    { key: "D2", name: "Second diagonal", d: "M266 262C284 276 300 292 312 318", fact: "More branches, more collateral routes." },
    { key: "LCx", name: "Circumflex", d: "M240 126C270 122 300 134 318 158C330 176 336 198 338 222", fact: "Wraps around the back of the heart in the left AV groove." },
    { key: "OM", name: "Obtuse marginal", d: "M330 180C342 208 342 240 334 270", fact: "Feeds the lateral wall of the left ventricle." },
    { key: "RCA", name: "Right coronary", d: "M200 114C176 120 150 132 130 160C108 194 100 240 110 284C120 318 150 346 192 360", fact: "Runs in the right AV groove. Often supplies the SA and AV nodes." },
    { key: "AM", name: "Acute marginal", d: "M106 244C122 262 138 280 150 300", fact: "Supplies the right ventricle." },
    { key: "PDA", name: "Posterior descending", d: "M192 360C222 372 254 380 290 386", fact: "In most people it comes from the RCA. Finish line." },
  ],
};

// One per day, in order; wraps around. Keep them short, true and sourced.
export const FACTS = [
  { text: "Why 7,500? In a study of 16,741 older women, death rates fell as daily steps rose, then leveled off around 7,500.", src: "Lee et al., JAMA Intern Med 2019" },
  { text: "Across 15 studies, more daily steps meant lower risk of death, leveling off around 6,000 to 8,000 steps for adults over 60 and 8,000 to 10,000 for younger adults.", src: "Paluch et al., Lancet Public Health 2022" },
  { text: "Each extra 1,000 steps a day was linked to a 15% lower risk of death from any cause.", src: "Banach et al., Eur J Prev Cardiol 2023" },
  { text: "Your heart beats about 100,000 times a day.", src: "American Heart Association" },
  { text: "At rest, the heart pumps about 5 liters of blood a minute.", src: "Standard physiology" },
  { text: "Short walks count. U.S. guidelines dropped the old rule that activity had to last 10 minutes to matter.", src: "Physical Activity Guidelines for Americans, 2nd ed., 2018" },
  { text: "Adults should aim for at least 150 minutes of moderate activity a week. Brisk walking counts.", src: "Physical Activity Guidelines for Americans, 2nd ed., 2018" },
  { text: "About 100 steps a minute is brisk enough to count as moderate-intensity walking for most adults.", src: "Tudor-Locke et al., Int J Behav Nutr Phys Act 2019" },
  { text: "A few minutes of walking after a meal lowers the blood sugar spike compared with sitting.", src: "Buffey et al., Sports Medicine 2022" },
  { text: "The coronary arteries fill mostly during diastole, while the heart muscle relaxes.", src: "Standard physiology" },
  { text: "The LAD supplies roughly half of the left ventricle, which is why a blockage there is called the widowmaker.", src: "Standard anatomy" },
  { text: "In about 7 of 10 people, the posterior descending artery comes off the right coronary artery.", src: "Standard anatomy" },
  { text: "Regular aerobic exercise lowers systolic blood pressure by about 5 to 8 mmHg in adults with hypertension.", src: "ACC/AHA Hypertension Guideline 2017" },
  { text: "In one study across 36 hospitals, nurses walked between 1 and 5 miles in a 10-hour day shift.", src: "Hendrich et al., Permanente Journal 2008" },
  { text: "Heart disease is the leading cause of death in the United States.", src: "CDC" },
  { text: "Walking speed is sometimes called the sixth vital sign.", src: "Fritz & Lusardi, J Geriatr Phys Ther 2009" },
  { text: "The 10,000-step goal started as the name of a 1960s Japanese pedometer, manpo-kei, meaning 10,000-step meter.", src: "Tudor-Locke & Bassett, Sports Med 2004" },
  { text: "Atrial fibrillation is the most common sustained heart rhythm problem.", src: "ACC/AHA AF Guideline 2023" },
  { text: "The heart's built-in pacemaker, the sinoatrial node, sits in the wall of the right atrium.", src: "Standard anatomy" },
  { text: "HCA Florida Lake Monroe Hospital runs the only full-service cardiovascular program in Seminole and West Volusia counties.", src: "hcafloridahealthcare.com" },
  { text: "The Sanford RiverWalk runs nearly five miles along Lake Monroe and is part of a 26-mile loop around the lake. That's almost a marathon.", src: "City of Sanford" },
  { text: "Breaking up long periods of sitting with short walks lowers blood sugar and insulin after meals.", src: "Dunstan et al., Diabetes Care 2012" },
  { text: "Taking the stairs at a steady pace is vigorous exercise, harder than a brisk walk on flat ground.", src: "Compendium of Physical Activities" },
  { text: "7,500 steps is about 5 to 6 km for most adults, depending on stride length.", src: "Typical stride 0.7 to 0.8 m" },
];

// One quiz per week of the challenge (wraps around). Types:
//   rhythm  – an animated ECG strip; pick the rhythm
//   guess   – slide to a number, then see the answer count up
//   artery  – tap the right artery on the heart
//   choice  – multiple choice
//   mythfact – myth or fact
export const QUIZ = [
  [
    { type: "rhythm", rhythm: "afib", q: "Name that rhythm.", options: ["Normal sinus rhythm", "Atrial fibrillation", "Atrial flutter", "Ventricular tachycardia"], answer: 1, explain: "Irregularly irregular, no clear P waves. Atrial fibrillation." },
    { type: "guess", q: "How many times does your heart beat in a day?", min: 10000, max: 300000, step: 5000, answer: 100000, unit: "beats", explain: "About 100,000. That's roughly 36 million a year." },
    { type: "mythfact", q: "You need 10,000 steps a day before your heart gets any benefit.", answer: false, explain: "Myth. Benefits start well below that and level off around 7,500 to 10,000 for most adults." },
  ],
  [
    { type: "artery", q: "Tap the artery nicknamed the widowmaker.", answer: "LAD", explain: "The left anterior descending artery. It supplies roughly half of the left ventricle." },
    { type: "guess", q: "How many miles is the trail loop around Lake Monroe?", min: 5, max: 60, step: 1, answer: 26, unit: "miles", explain: "26 miles. Walk it once and you've nearly done a marathon." },
    { type: "mythfact", q: "Taking the stairs counts as vigorous exercise.", answer: true, explain: "Fact. Climbing stairs at a steady pace is harder work than a brisk walk." },
  ],
  [
    { type: "rhythm", rhythm: "flutter", q: "Name that rhythm.", options: ["Atrial flutter", "Sinus tachycardia", "Atrial fibrillation", "Ventricular tachycardia"], answer: 0, explain: "Sawtooth flutter waves with regular QRS complexes. Atrial flutter." },
    { type: "guess", q: "At rest, how many liters of blood does the heart pump each minute?", min: 1, max: 20, step: 0.5, answer: 5, unit: "liters", explain: "About 5 liters a minute, close to your whole blood volume." },
    { type: "choice", q: "Which structure is the heart's natural pacemaker?", options: ["AV node", "SA node", "Bundle of His", "Purkinje fibers"], answer: 1, explain: "The sinoatrial node, in the right atrium." },
  ],
  [
    { type: "rhythm", rhythm: "vt", q: "Name that rhythm.", options: ["Sinus rhythm", "Atrial flutter", "Ventricular tachycardia", "Atrial fibrillation"], answer: 2, explain: "Fast, wide, regular complexes. Ventricular tachycardia." },
    { type: "artery", q: "In most people, which artery gives rise to the posterior descending artery?", answer: "RCA", explain: "The right coronary artery, in about 7 of 10 people (right-dominant)." },
    { type: "mythfact", q: "A walk only counts if it lasts at least 10 minutes.", answer: false, explain: "Myth. Current U.S. guidelines say any movement adds up." },
  ],
  [
    { type: "rhythm", rhythm: "sinus", q: "Name that rhythm.", options: ["Atrial fibrillation", "Normal sinus rhythm", "Ventricular tachycardia", "Atrial flutter"], answer: 1, explain: "A P wave before every QRS, regular, 60 to 100 a minute. Normal sinus rhythm." },
    { type: "guess", q: "About how many miles is 7,500 steps?", min: 1, max: 10, step: 0.5, answer: 3.5, unit: "miles", explain: "About 3.5 miles, or 5 to 6 km, for most adults." },
    { type: "artery", q: "Tap the circumflex artery.", answer: "LCx", explain: "The left circumflex wraps around the back of the heart in the left AV groove." },
  ],
  [
    { type: "rhythm", rhythm: "stemi", q: "What stands out on this strip?", options: ["ST elevation", "No P waves", "Wide QRS", "Nothing, it's normal"], answer: 0, explain: "The ST segment is raised above baseline. In the right context, that's a STEMI: time is muscle." },
    { type: "mythfact", q: "A short walk after meals lowers blood sugar spikes.", answer: true, explain: "Fact. Even a few minutes helps compared with sitting." },
    { type: "choice", q: "Which county does the Sanford RiverWalk sit in?", options: ["Orange", "Volusia", "Seminole", "Lake"], answer: 2, explain: "Seminole County. The RiverWalk runs along the south shore of Lake Monroe." },
  ],
];
