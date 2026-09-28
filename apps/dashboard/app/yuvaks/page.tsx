import YuvaksClient from './YuvaksClient';

type SearchParams = {
  q?: string | string[];
  kk?: string | string[];
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

export default async function YuvaksPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const params = await searchParams;

  return (
    <YuvaksClient
      initialSearch={firstParam(params?.q)}
      initialKK={firstParam(params?.kk) || 'all'}
    />
  );
}
