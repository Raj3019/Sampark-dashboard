import { getSabhaData } from '../lib/sabhaWorkbookService';
import { getPastDates } from '../lib/analytics';

async function main() {
  const { data } = await getSabhaData({ forceFresh: true });

  const countsBySabha = data.yuvaks.reduce<Record<string, number>>((acc, y) => {
    acc[y.sabhaType] = (acc[y.sabhaType] ?? 0) + 1;
    return acc;
  }, {});

  const kishorAlias = data.yuvaks.filter((y) => {
    const s = y.sabhaType.trim().toLowerCase();
    return s === 'chirag nagar(kishor)' || s === 'chirag nagar';
  });

  const pastDates = getPastDates(data.dates);
  const activePastDates = pastDates.filter((d) => kishorAlias.some((y) => y.dateAttendance[d]));

  const trueCount = kishorAlias.reduce((sum, y) => {
    return sum + Object.values(y.dateAttendance).filter(Boolean).length;
  }, 0);

  const uniqueAttendanceKeys = new Set<string>();
  for (const y of kishorAlias.slice(0, 20)) {
    Object.keys(y.dateAttendance).forEach((k) => uniqueAttendanceKeys.add(k));
  }

  console.log('--- SABHA DATA DEBUG ---');
  console.log('total yuvaks:', data.yuvaks.length);
  console.log('counts by sabhaType:', countsBySabha);
  console.log('total dates:', data.dates.length);
  console.log('dates tail:', data.dates.slice(-12));
  console.log('pastDates count:', pastDates.length);
  console.log('activePastDates count (kishor alias):', activePastDates.length);
  console.log('activePastDates tail:', activePastDates.slice(-12));
  console.log('kishor alias yuvaks:', kishorAlias.length);
  console.log('total TRUE attendance flags in kishor alias:', trueCount);
  console.log('attendance key sample:', Array.from(uniqueAttendanceKeys).slice(-20));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
