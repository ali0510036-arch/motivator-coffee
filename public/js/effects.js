function initEffects() {
  if (window.matchMedia('(max-width: 768px)').matches) {
    document.querySelectorAll('.reveal, .reveal-stagger').forEach((el) => el.classList.add('visible'));
    initHeaderScroll();
    return;
  }
  initScrollReveal();
  initHeaderScroll();
  initHeroParallax();
}

function initScrollReveal() {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
  );

  document.querySelectorAll('.reveal, .reveal-stagger').forEach((el) => {
    observer.observe(el);
  });
}

function initHeaderScroll() {
  const header = document.querySelector('.header');
  const hero = document.querySelector('.hero');
  if (!header) return;

  const onScroll = () => {
    const y = window.scrollY;
    header.classList.toggle('header--scrolled', y > 40);
    const threshold = hero ? Math.max(hero.offsetHeight - 100, 420) : 480;
    header.classList.toggle('header--dark', y > threshold);
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

function initHeroParallax() {
  const visual = document.getElementById('heroVisual');
  if (!visual || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  visual.addEventListener('mousemove', (e) => {
    const rect = visual.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;

    visual.style.setProperty('--mx', `${x * 14}px`);
    visual.style.setProperty('--my', `${y * 10}px`);
    visual.style.setProperty('--tilt-y', `${x * 8}deg`);
    visual.style.setProperty('--tilt-x', `${-y * 5}deg`);
  });

  visual.addEventListener('mouseleave', () => {
    visual.style.setProperty('--mx', '0px');
    visual.style.setProperty('--my', '0px');
    visual.style.setProperty('--tilt-y', '0deg');
    visual.style.setProperty('--tilt-x', '0deg');
  });
}

function pulseCartButton() {
  const btn = document.getElementById('cartBtn');
  if (!btn) return;
  btn.classList.add('cart-btn--pulse');
  setTimeout(() => btn.classList.remove('cart-btn--pulse'), 400);
}

window.pulseCartButton = pulseCartButton;

document.addEventListener('DOMContentLoaded', initEffects);
