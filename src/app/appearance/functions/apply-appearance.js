export function applyAppearance(appearance) {
  document.documentElement.classList.toggle('dark', appearance.theme === 'dark');
  document.documentElement.style.colorScheme = appearance.theme === 'dark' ? 'dark' : 'light';
}
