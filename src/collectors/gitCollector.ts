import { simpleGit } from 'simple-git';
export type DiffResult = { mode: 'git', files: string[], raw: string, base: string, head: string };

export async function collectDiff(base='main', head='HEAD'): Promise<DiffResult> {
  const git = simpleGit();
  const diffSummary = await git.diffSummary([`${base}...${head}`]);
  const raw = await git.diff([`${base}...${head}`, '--name-only']).catch(()=> diffSummary.files.map(f=>f.file).join('\n'));
  const files = diffSummary.files.map(f => f.file);
  // Also get actual diff content for AST analyzer
  const fullDiff = await git.diff([`${base}...${head}`]).catch(()=> '');
  return { mode: 'git', files, raw: fullDiff || raw, base, head };
}
