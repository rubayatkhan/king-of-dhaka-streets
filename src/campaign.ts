export type Neighborhood = 'riverfront' | 'bazaar' | 'boulevard';
export interface StageProfile {
  id: number; vehicleIndex: number; lessonIndex: 0 | 1 | 2;
  name: string; bangla: string; neighborhood: Neighborhood; objective: string;
  routeLength: number; parTime: number; nearMissTarget: number;
}
export const NEIGHBORHOODS: Neighborhood[] = ['bazaar', 'riverfront', 'boulevard'];
const lessonNames = [
  ['Bakarkhani breakfast', 'Catch the launch', 'Rush-hour rookie'],
  ['Passenger to the ghat', 'The wedding invitation', 'Rickshaw royalty'],
  ['Tea before the rain', 'Parcel for the bazaar', 'Last delivery home'],
  ['Family outing', 'The evening pickup', 'Own your lane'],
  ['Market-day cargo', 'Make way for the market', 'The crown run'],
];
const bangla = ['প্রথম যাত্রা', 'সাবধানে চলুন', 'রাজপথের পরীক্ষা'];
const objectives = [
  ['Bring breakfast through the bazaar. Read the gaps and save the bakarkhani.', 'Reach the ghat before the launch leaves. Watch the paan warnings.', 'Get home through rush hour. Listen for the bus behind you.'],
  ['Take your passenger to the river. Keep a steady line.', 'Carry an invitation across the neighborhood. Dodge spills and give walkers room.', 'Finish the fare with composure. A clean ride earns respect.'],
  ['Take hot tea to a friend. Find openings without losing your nerve.', 'Deliver a parcel through the market. Watch both the street and your mirror.', 'Bring the last delivery home. Chain close passes to earn extra stars.'],
  ['Bring the family to the river. Your horn carries a little more weight.', 'Make the pickup through evening traffic. Brake early for blocked lanes.', 'Read the city from behind the wheel. Clean riding earns the next keys.'],
  ['Bring market cargo through the city. Smaller traffic makes room for you.', 'Carry a full load past the market. Even a king watches for cows and broken road.', 'Complete the crown run. Command the traffic and bring your cargo home.'],
];
export const STAGES: StageProfile[] = Array.from({ length: 15 }, (_, id) => {
  const vehicleIndex = Math.floor(id / 3), lessonIndex = (id % 3) as 0 | 1 | 2;
  const speed = [13, 14, 19, 21, 23][vehicleIndex];
  const routeLength = 650 + vehicleIndex * 80 + lessonIndex * 70;
  return { id, vehicleIndex, lessonIndex, name: lessonNames[vehicleIndex][lessonIndex], bangla: bangla[lessonIndex],
    neighborhood: NEIGHBORHOODS[(vehicleIndex + lessonIndex) % 3],
    objective: objectives[vehicleIndex][lessonIndex],
    routeLength, parTime: Math.ceil(routeLength / speed * 1.65 + 10), nearMissTarget: 2 + lessonIndex * 2 };
});
export function getStage(vehicleIndex: number, lessonIndex = 0): StageProfile {
  const vehicle = Number.isFinite(vehicleIndex) ? Math.max(0, Math.min(4, Math.floor(vehicleIndex))) : 0;
  const lesson = Number.isFinite(lessonIndex) ? Math.max(0, Math.min(2, Math.floor(lessonIndex))) : 0;
  return STAGES[vehicle * 3 + lesson];
}
