// Scroll reveal
const revealEls = document.querySelectorAll('.reveal, .stop');
const io = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('in-view');
      io.unobserve(e.target);
    }
  });
}, { threshold: 0.15 });
revealEls.forEach(el => io.observe(el));

// Split-flap counter animation
function animateFlap(el, target) {
  const digits = String(target).padStart(el.children.length, '0').split('');
  el.querySelectorAll('.flap').forEach((flap, i) => {
    let current = 0;
    const targetDigit = parseInt(digits[i], 10);
    const interval = setInterval(() => {
      flap.textContent = current;
      if (current === targetDigit) clearInterval(interval);
      current = (current + 1) % 10;
    }, 60 + i * 15);
  });
}

const boardObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      document.querySelectorAll('.flap-row').forEach(row => {
        animateFlap(row, row.dataset.target);
      });
      boardObserver.disconnect();
    }
  });
}, { threshold: 0.4 });
const boardSection = document.querySelector('.board-section');
if (boardSection) boardObserver.observe(boardSection);

// Mobile menu
const burger = document.getElementById('landingBurger');
const mobileMenu = document.getElementById('mobileMenu');
if (burger && mobileMenu) {
  burger.addEventListener('click', () => {
    burger.classList.toggle('open');
    mobileMenu.classList.toggle('open');
  });
  mobileMenu.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      burger.classList.remove('open');
      mobileMenu.classList.remove('open');
    });
  });
}

// Smooth scroll
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', (e) => {
    const target = document.querySelector(a.getAttribute('href'));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth' });
    }
  });
});
