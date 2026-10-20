// tiny glob matcher without extra dep
export function minimatch(file: string, pattern: string): boolean {
  if (pattern.includes('**')) {
    const base = pattern.split('**')[0];
    return file.startsWith(base);
  }
  if (pattern.includes('*')) {
    const re = new RegExp('^' + pattern.replace(/\./g,'\\.').replace(/\*/g,'.*') + '$');
    return re.test(file);
  }
  return file === pattern || file.startsWith(pattern.replace('/**',''));
}
