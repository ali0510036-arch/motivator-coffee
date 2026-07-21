const THEME_KEY = 'motivator_theme';

const themes = ['nexus', 'lumina', 'noir', 'midnight', 'espresso', 'cream', 'citrus', 'arctic'];

function getTheme() {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === 'cream' && !sessionStorage.getItem('theme_migrated')) {
    sessionStorage.setItem('theme_migrated', '1');
    return 'nexus';
  }
  if (stored === 'lumina' && !localStorage.getItem('style_nexus_v1')) {
    localStorage.setItem('style_nexus_v1', '1');
    localStorage.setItem(THEME_KEY, 'nexus');
    return 'nexus';
  }
  if (stored === 'noir' && !localStorage.getItem('style_nexus_v1')) {
    localStorage.setItem('style_nexus_v1', '1');
    localStorage.setItem(THEME_KEY, 'nexus');
    return 'nexus';
  }
  return stored || 'nexus';
}

function setTheme(name) {
  if (!themes.includes(name)) return;
  document.documentElement.setAttribute('data-theme', name);
  localStorage.setItem(THEME_KEY, name);
  updateActiveOption(name);
}

function updateActiveOption(name) {
  document.querySelectorAll('.theme-option').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.theme === name);
  });
}

function initThemes() {
  const theme = getTheme();
  document.documentElement.setAttribute('data-theme', theme);
  if (theme === 'noir' && localStorage.getItem(THEME_KEY) === 'cream') {
    localStorage.setItem(THEME_KEY, 'noir');
  }

  const switcher = document.getElementById('themeSwitcher');
  const toggle = document.getElementById('themeToggle');
  if (!switcher || !toggle) return;

  updateActiveOption(theme);

  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    switcher.classList.toggle('open');
  });

  document.querySelectorAll('.theme-option').forEach((btn) => {
    btn.addEventListener('click', () => {
      setTheme(btn.dataset.theme);
      switcher.classList.remove('open');
    });
  });

  document.addEventListener('click', (e) => {
    if (!switcher.contains(e.target)) {
      switcher.classList.remove('open');
    }
  });
}

document.addEventListener('DOMContentLoaded', initThemes);
