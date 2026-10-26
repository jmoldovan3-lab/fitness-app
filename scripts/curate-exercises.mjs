#!/usr/bin/env node
// Reproducible import of the full free-exercise-db
// (https://github.com/yuhonas/free-exercise-db, public domain / Unlicense).
// Downloads dist/exercises.json + both image frames per exercise, resizes them to
// 320px wide WebP and writes:
//   src/data/exercises.json      (metadata for every exercise, bundled into the app)
//   public/exercises/<id>/0.webp, 1.webp   (runtime-cached by the service worker, not precached)
// Every exercise gets app tags (movement pattern, role, required equipment keys, skill, loadType,
// and `gen` = usable by the session generator). A hand-picked FEATURED list overrides the derived
// tags for well-known staples, which the generator prefers.
// Usage: npm run curate   (downloads cached in .cache/free-exercise-db; WEBP_Q / WEBP_W override quality/width)
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const REPO_RAW = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const CACHE = path.join(ROOT, '.cache/free-exercise-db');
const OUT_JSON = path.join(ROOT, 'src/data/exercises.json');
const OUT_IMG = path.join(ROOT, 'public/exercises');
const WIDTH = Number(process.env.WEBP_W ?? 320);
const QUALITY = Number(process.env.WEBP_Q ?? 70);

// Equipment keys used by the app: barbell, dumbbell, kettlebell, cable, machine, bands, pullupBar,
// bench, medicineBall, stabilityBall, foamRoller, other. Bodyweight is always available (empty list).
// [id, pattern, role, requiredEquipment[], skill 1-3]
// pattern: squat | hinge | lunge | hpush | vpush | hpull | vpull | core | biceps | triceps |
//          shoulders | calves | conditioning | other | stretch | cardio
// role: main (heavy compound) | secondary (compound) | accessory (isolation)
const FEATURED = [
  // squat
  ['Barbell_Squat', 'squat', 'main', ['barbell'], 2],
  ['Front_Barbell_Squat', 'squat', 'main', ['barbell'], 3],
  ['Goblet_Squat', 'squat', 'secondary', ['kettlebell'], 1],
  ['Dumbbell_Squat', 'squat', 'secondary', ['dumbbell'], 1],
  ['Front_Squats_With_Two_Kettlebells', 'squat', 'secondary', ['kettlebell'], 2],
  ['Leg_Press', 'squat', 'secondary', ['machine'], 1],
  ['Hack_Squat', 'squat', 'secondary', ['machine'], 2],
  ['Squats_-_With_Bands', 'squat', 'secondary', ['bands'], 1],
  ['Bodyweight_Squat', 'squat', 'secondary', [], 1],
  ['Leg_Extensions', 'squat', 'accessory', ['machine'], 1],
  // hinge
  ['Barbell_Deadlift', 'hinge', 'main', ['barbell'], 2],
  ['Romanian_Deadlift', 'hinge', 'main', ['barbell'], 2],
  ['Stiff-Legged_Dumbbell_Deadlift', 'hinge', 'secondary', ['dumbbell'], 1],
  ['One-Arm_Kettlebell_Swings', 'hinge', 'secondary', ['kettlebell'], 2],
  ['Kettlebell_One-Legged_Deadlift', 'hinge', 'secondary', ['kettlebell'], 2],
  ['Barbell_Hip_Thrust', 'hinge', 'secondary', ['barbell', 'bench'], 2],
  ['Good_Morning', 'hinge', 'secondary', ['barbell'], 3],
  ['Cable_Deadlifts', 'hinge', 'secondary', ['cable'], 1],
  ['Band_Good_Morning', 'hinge', 'secondary', ['bands'], 1],
  ['Single_Leg_Glute_Bridge', 'hinge', 'secondary', [], 1],
  ['Hyperextensions_With_No_Hyperextension_Bench', 'hinge', 'accessory', [], 1],
  ['Lying_Leg_Curls', 'hinge', 'accessory', ['machine'], 1],
  ['Seated_Leg_Curl', 'hinge', 'accessory', ['machine'], 1],
  // lunge / single leg
  ['Dumbbell_Lunges', 'lunge', 'secondary', ['dumbbell'], 1],
  ['Barbell_Lunge', 'lunge', 'secondary', ['barbell'], 2],
  ['Split_Squat_with_Dumbbells', 'lunge', 'secondary', ['dumbbell'], 1],
  ['Dumbbell_Rear_Lunge', 'lunge', 'secondary', ['dumbbell'], 1],
  ['Dumbbell_Step_Ups', 'lunge', 'secondary', ['dumbbell', 'bench'], 1],
  ['Split_Squats', 'lunge', 'secondary', [], 1],
  ['Bodyweight_Walking_Lunge', 'lunge', 'secondary', [], 1],
  ['Kettlebell_Pistol_Squat', 'lunge', 'secondary', ['kettlebell'], 3],
  // horizontal push
  ['Barbell_Bench_Press_-_Medium_Grip', 'hpush', 'main', ['barbell', 'bench'], 2],
  ['Barbell_Incline_Bench_Press_-_Medium_Grip', 'hpush', 'main', ['barbell', 'bench'], 2],
  ['Dumbbell_Bench_Press', 'hpush', 'secondary', ['dumbbell', 'bench'], 1],
  ['Incline_Dumbbell_Press', 'hpush', 'secondary', ['dumbbell', 'bench'], 1],
  ['Machine_Bench_Press', 'hpush', 'secondary', ['machine'], 1],
  ['Bench_Press_-_With_Bands', 'hpush', 'secondary', ['bands', 'bench'], 1],
  ['One-Arm_Kettlebell_Floor_Press', 'hpush', 'secondary', ['kettlebell'], 1],
  ['Pushups', 'hpush', 'secondary', [], 1],
  ['Incline_Push-Up', 'hpush', 'secondary', [], 1],
  ['Push-Ups_With_Feet_Elevated', 'hpush', 'secondary', [], 2],
  ['Dumbbell_Flyes', 'hpush', 'accessory', ['dumbbell', 'bench'], 1],
  ['Butterfly', 'hpush', 'accessory', ['machine'], 1],
  ['Cable_Crossover', 'hpush', 'accessory', ['cable'], 1],
  // vertical push
  ['Standing_Military_Press', 'vpush', 'main', ['barbell'], 2],
  ['Dumbbell_Shoulder_Press', 'vpush', 'secondary', ['dumbbell'], 1],
  ['Arnold_Dumbbell_Press', 'vpush', 'secondary', ['dumbbell'], 2],
  ['Two-Arm_Kettlebell_Military_Press', 'vpush', 'secondary', ['kettlebell'], 2],
  ['Machine_Shoulder_Military_Press', 'vpush', 'secondary', ['machine'], 1],
  ['Cable_Shoulder_Press', 'vpush', 'secondary', ['cable'], 1],
  ['Shoulder_Press_-_With_Bands', 'vpush', 'secondary', ['bands'], 1],
  ['Handstand_Push-Ups', 'vpush', 'secondary', [], 3],
  // horizontal pull
  ['Bent_Over_Barbell_Row', 'hpull', 'main', ['barbell'], 2],
  ['One-Arm_Dumbbell_Row', 'hpull', 'secondary', ['dumbbell', 'bench'], 1],
  ['Bent_Over_Two-Dumbbell_Row', 'hpull', 'secondary', ['dumbbell'], 1],
  ['Dumbbell_Incline_Row', 'hpull', 'secondary', ['dumbbell', 'bench'], 1],
  ['One-Arm_Kettlebell_Row', 'hpull', 'secondary', ['kettlebell'], 1],
  ['Seated_Cable_Rows', 'hpull', 'secondary', ['cable'], 1],
  ['Leverage_Iso_Row', 'hpull', 'secondary', ['machine'], 1],
  ['Inverted_Row', 'hpull', 'secondary', ['pullupBar'], 1],
  ['Face_Pull', 'hpull', 'accessory', ['cable'], 1],
  ['Band_Pull_Apart', 'hpull', 'accessory', ['bands'], 1],
  ['Back_Flyes_-_With_Bands', 'hpull', 'accessory', ['bands'], 1],
  ['Reverse_Flyes', 'hpull', 'accessory', ['dumbbell'], 1],
  ['Superman', 'hpull', 'accessory', [], 1],
  // vertical pull
  ['Pullups', 'vpull', 'main', ['pullupBar'], 2],
  ['Chin-Up', 'vpull', 'secondary', ['pullupBar'], 2],
  ['Band_Assisted_Pull-Up', 'vpull', 'secondary', ['pullupBar', 'bands'], 1],
  ['Wide-Grip_Lat_Pulldown', 'vpull', 'secondary', ['cable'], 1],
  ['Close-Grip_Front_Lat_Pulldown', 'vpull', 'secondary', ['cable'], 1],
  ['Straight-Arm_Pulldown', 'vpull', 'accessory', ['cable'], 1],
  // core
  ['Plank', 'core', 'accessory', [], 1],
  ['Dead_Bug', 'core', 'accessory', [], 1],
  ['Side_Bridge', 'core', 'accessory', [], 1],
  ['Reverse_Crunch', 'core', 'accessory', [], 1],
  ['Russian_Twist', 'core', 'accessory', [], 1],
  ['Flat_Bench_Lying_Leg_Raise', 'core', 'accessory', ['bench'], 1],
  ['Hanging_Leg_Raise', 'core', 'accessory', ['pullupBar'], 2],
  ['Cable_Crunch', 'core', 'accessory', ['cable'], 1],
  ['Pallof_Press', 'core', 'accessory', ['cable'], 1],
  ['Ab_Crunch_Machine', 'core', 'accessory', ['machine'], 1],
  // arms
  ['Barbell_Curl', 'biceps', 'accessory', ['barbell'], 1],
  ['Dumbbell_Bicep_Curl', 'biceps', 'accessory', ['dumbbell'], 1],
  ['Hammer_Curls', 'biceps', 'accessory', ['dumbbell'], 1],
  ['Standing_Biceps_Cable_Curl', 'biceps', 'accessory', ['cable'], 1],
  ['Machine_Bicep_Curl', 'biceps', 'accessory', ['machine'], 1],
  ['Triceps_Pushdown', 'triceps', 'accessory', ['cable'], 1],
  ['Lying_Triceps_Press', 'triceps', 'accessory', ['barbell', 'bench'], 2],
  ['Standing_Dumbbell_Triceps_Extension', 'triceps', 'accessory', ['dumbbell'], 1],
  ['Band_Skull_Crusher', 'triceps', 'accessory', ['bands'], 1],
  ['Bench_Dips', 'triceps', 'accessory', ['bench'], 1],
  ['Push-Ups_-_Close_Triceps_Position', 'triceps', 'accessory', [], 1],
  // shoulders
  ['Side_Lateral_Raise', 'shoulders', 'accessory', ['dumbbell'], 1],
  ['Cable_Seated_Lateral_Raise', 'shoulders', 'accessory', ['cable'], 1],
  ['Lateral_Raise_-_With_Bands', 'shoulders', 'accessory', ['bands'], 1],
  // calves
  ['Standing_Calf_Raises', 'calves', 'accessory', ['machine'], 1],
  ['Standing_Dumbbell_Calf_Raise', 'calves', 'accessory', ['dumbbell'], 1],
  ['Calf_Raises_-_With_Bands', 'calves', 'accessory', ['bands'], 1],
  // conditioning
  ['Kettlebell_Thruster', 'conditioning', 'secondary', ['kettlebell'], 2],
  ['Mountain_Climbers', 'conditioning', 'accessory', [], 1],
  ['Freehand_Jump_Squat', 'conditioning', 'accessory', [], 2],
];

// Categories the generator may use. Stretching, cardio, strongman (atlas stones, tyres…) and
// olympic weightlifting (technical, coach-supervised lifts) stay in the library only.
const GEN_CATEGORIES = new Set(['strength', 'powerlifting', 'plyometrics']);

// Technical or special-kit lifts kept out of generated workouts (still in the library).
const NOT_GEN = /\b(clean|snatch|jerk)\b|chains|with chains|board press|pin press|off pins|anti-gravity|car drivers|atlas/i;

const EQUIP_MAP = {
  barbell: ['barbell'], 'e-z curl bar': ['barbell'], dumbbell: ['dumbbell'], kettlebells: ['kettlebell'],
  cable: ['cable'], machine: ['machine'], bands: ['bands'], 'body only': [], null: [],
  'medicine ball': ['medicineBall'], 'exercise ball': ['stabilityBall'], 'foam roll': ['foamRoller'], other: ['other'],
};

function deriveEquipment(e) {
  const eq = [...(EQUIP_MAP[String(e.equipment)] ?? ['other'])];
  const n = e.name;
  const free = ['barbell', 'e-z curl bar', 'dumbbell', 'kettlebells', 'bands', 'body only', 'null'].includes(String(e.equipment));
  if (free && /bench|incline|decline|preacher/i.test(n) && !/bench sprint|bench jump/i.test(n)) eq.push('bench');
  if (['body only', 'null', 'bands'].includes(String(e.equipment)) && /pull-?ups?\b|chin-?ups?\b|chins\b|hanging|muscle up|\bdips?\b(?!.*bench)/i.test(n) && !/bench dip/i.test(n)) eq.push('pullupBar');
  return [...new Set(eq)];
}

function derivePattern(e) {
  const n = e.name.toLowerCase();
  const m = e.primaryMuscles[0];
  if (e.category === 'stretching') return 'stretch';
  if (e.category === 'cardio') return 'cardio';
  if (e.category === 'plyometrics') return 'conditioning';
  const single = /lunge|split squat|step[- ]?up|pistol|single[- ]leg|one[- ]leg|bulgarian/.test(n);
  switch (m) {
    case 'quadriceps': return single ? 'lunge' : 'squat';
    case 'glutes': return single ? 'lunge' : 'hinge';
    case 'hamstrings': case 'lower back': return single && !/deadlift/.test(n) ? 'lunge' : 'hinge';
    case 'chest': return e.force === 'pull' ? 'hpull' : 'hpush';
    case 'shoulders':
      if (/rear|face pull|reverse fly|back fly/.test(n)) return 'hpull';
      return e.mechanic === 'compound' && e.force === 'push' ? 'vpush' : 'shoulders';
    case 'lats': return /pull-?up|chin|pulldown|pullover|muscle up|pull down/.test(n) ? 'vpull' : 'hpull';
    case 'middle back': return 'hpull';
    case 'traps': return /row/.test(n) ? 'hpull' : 'shoulders';
    case 'biceps': return e.mechanic === 'compound' && /chin|pull/.test(n) ? 'vpull' : 'biceps';
    case 'triceps': return e.mechanic === 'compound' ? (/dip|press|push/.test(n) ? 'hpush' : 'triceps') : 'triceps';
    case 'abdominals': return 'core';
    case 'calves': return 'calves';
    default: return 'other'; // forearms, neck, adductors, abductors
  }
}

const BIG = new Set(['squat', 'hinge', 'hpush', 'vpush', 'hpull', 'vpull']);
function deriveRole(e, pattern, equipment) {
  if (e.mechanic !== 'compound') return 'accessory';
  const unilateral = /one[- ]arm|single[- ]arm|one[- ]leg|single[- ]leg|alternat/i.test(e.name);
  if (BIG.has(pattern) && equipment.includes('barbell') && !unilateral) return 'main';
  return 'secondary';
}

const LEVEL_SKILL = { beginner: 1, intermediate: 2, expert: 3 };
const LOAD_TYPE = (eq) =>
  eq.includes('barbell') ? 'barbell'
  : eq.includes('dumbbell') ? 'dumbbell'
  : eq.includes('kettlebell') ? 'kettlebell'
  : eq.includes('machine') ? 'machine'
  : eq.includes('cable') ? 'cable'
  : eq.includes('bands') ? 'band'
  : eq.includes('medicineBall') ? 'other'
  : 'bodyweight';

async function cached(rel) {
  const file = path.join(CACHE, rel);
  try { return await fs.readFile(file); } catch {}
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(`${REPO_RAW}/${rel}`);
      if (!res.ok) throw new Error(`GET ${rel}: ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, buf);
      return buf;
    } catch (err) {
      if (attempt >= 3) throw err;
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }
  }
}

async function pool(items, n, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; await fn(items[k], k); } }));
}

const all = JSON.parse((await cached('dist/exercises.json')).toString());
const featured = new Map(FEATURED.map((p) => [p[0], p]));
for (const id of featured.keys()) if (!all.some((e) => e.id === id)) throw new Error(`Unknown featured id: ${id}`);
const usable = all.filter((e) => e.images.length >= 1).sort((a, b) => a.name.localeCompare(b.name));
const skipped = all.filter((e) => !e.images.length).map((e) => e.id);

await fs.rm(OUT_IMG, { recursive: true, force: true });
let bytes = 0;
let done = 0;
await pool(usable, 16, async (src) => {
  await fs.mkdir(path.join(OUT_IMG, src.id), { recursive: true });
  for (let i = 0; i < 2; i++) {
    const jpg = await cached(`exercises/${src.images[Math.min(i, src.images.length - 1)]}`);
    const webp = await sharp(jpg).resize({ width: WIDTH, withoutEnlargement: true }).webp({ quality: QUALITY, effort: 6 }).toBuffer();
    bytes += webp.length;
    await fs.writeFile(path.join(OUT_IMG, src.id, `${i}.webp`), webp);
  }
  if (++done % 100 === 0) console.log(`  ${done}/${usable.length}`);
});

const out = usable.map((src) => {
  const f = featured.get(src.id);
  const equipment = f ? f[3] : deriveEquipment(src);
  const pattern = f ? f[1] : derivePattern(src);
  const role = f ? f[2] : deriveRole(src, pattern, equipment);
  const gen = !!f || (GEN_CATEGORIES.has(src.category) && !equipment.some((q) => q === 'other' || q === 'foamRoller')
    && !['stretch', 'cardio'].includes(pattern) && !NOT_GEN.test(src.name));
  return {
    id: src.id, name: src.name, category: src.category, pattern, role, equipment,
    skill: f ? f[4] : LEVEL_SKILL[src.level] ?? 2,
    loadType: LOAD_TYPE(equipment),
    force: src.force ?? undefined, mechanic: src.mechanic ?? undefined,
    primaryMuscles: src.primaryMuscles, secondaryMuscles: src.secondaryMuscles,
    instructions: src.instructions,
    images: [`exercises/${src.id}/0.webp`, `exercises/${src.id}/1.webp`],
    ...(f ? { featured: true } : {}),
    ...(gen ? { gen: true } : {}),
  };
});
await fs.mkdir(path.dirname(OUT_JSON), { recursive: true });
await fs.writeFile(OUT_JSON, JSON.stringify(out) + '\n');
const json = (await fs.stat(OUT_JSON)).size;
console.log(`Imported ${out.length} exercises (${out.filter((e) => e.gen).length} generator-eligible, ${out.filter((e) => e.featured).length} featured); skipped without images: ${skipped.join(', ') || 'none'}`);
console.log(`${out.length * 2} WebP frames, ${(bytes / 1048576).toFixed(2)} MB (${WIDTH}px, q${QUALITY}); JSON ${(json / 1024).toFixed(0)} KB`);
