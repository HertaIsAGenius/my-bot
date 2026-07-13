// ── Star Generation ──
(function initStars() {
  var layers = document.querySelectorAll('.bg-layer');
  if (!layers.length) return;
  var starLayer = document.querySelector('.bg-layer.stars');
  if (!starLayer) return;
  for (var i = 0; i < 80; i++) {
    var star = document.createElement('div');
    var s = 1 + Math.random() * 2;
    var gold = Math.random() > 0.6;
    var color = gold ? 'rgba(203,169,105,0.6)' : 'rgba(238,236,228,0.4)';
    star.style.cssText =
      'position:absolute;border-radius:50%;' +
      'width:' + s + 'px;height:' + s + 'px;' +
      'left:' + (Math.random() * 100) + '%;' +
      'top:' + (Math.random() * 100) + '%;' +
      'opacity:' + (0.2 + Math.random() * 0.5) + ';' +
      'background:' + color + ';' +
      'box-shadow:0 0 ' + (s * 3) + 'px ' + color + ';';
    starLayer.appendChild(star);
  }
})();

// ── Parallax Scroll ──
(function initParallax() {
  var layers = document.querySelectorAll('.bg-layer');
  if (!layers.length) return;
  var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced) return;
  var ticking = false;
  window.addEventListener('scroll', function() {
    if (!ticking) {
      requestAnimationFrame(function() {
        var y = window.scrollY;
        layers.forEach(function(layer) {
          var speed = parseFloat(layer.getAttribute('data-speed') || '0');
          layer.style.transform = 'translateY(' + (y * speed) + 'px)';
        });
        ticking = false;
      });
      ticking = true;
    }
  }, { passive: true });
})();

// ── Route Progress Widget (station-based) ──
(function initRouteProgress() {
  var fill = document.getElementById('rpFill');
  var rpCurrent = document.getElementById('rpCurrent');
  var rpLabel = document.getElementById('rpLabel');
  var rpDots = document.querySelectorAll('.rp-dot');
  var routeProgress = document.getElementById('routeProgress');

  function maxScroll() {
    var doc = document.documentElement;
    var body = document.body;
    var h = Math.max(doc.scrollHeight, body.scrollHeight);
    return Math.max(h - window.innerHeight, 1);
  }

  function getScrollY() {
    return window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
  }

  function update() {
    var y = getScrollY();
    var total = maxScroll();
    var frac = Math.min(Math.max(y / total, 0), 1);
    var station = Math.min(5, Math.max(1, Math.ceil(frac * 5) || 1));

    if (rpCurrent) rpCurrent.textContent = station;
    if (rpLabel) rpLabel.textContent = station >= 5 ? 'Arrived' : 'En Route';
    rpDots.forEach(function(dot, i) {
      dot.classList.toggle('filled', i < station);
    });
  }

  window.addEventListener('scroll', update, { passive: true });
  update();

  function goToNextStation() {
    var y = getScrollY();
    var frac = y / maxScroll();
    var currentStation = Math.min(5, Math.max(1, Math.ceil(frac * 5) || 1));
    var nextStation = currentStation >= 5 ? 0 : currentStation;
    var targetY = (nextStation / 5) * maxScroll();
    window.scrollTo({ top: targetY, behavior: 'smooth' });
  }

  if (routeProgress) {
    routeProgress.addEventListener('click', goToNextStation);
    routeProgress.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goToNextStation(); }
    });
  }
})();

// ── Scroll Reveal ──
var revealEls = document.querySelectorAll('.reveal, .stop');
var observer = new IntersectionObserver(function(entries) {
  entries.forEach(function(e) {
    if (e.isIntersecting) {
      e.target.classList.add('in-view');
      observer.unobserve(e.target);
    }
  });
}, { threshold: 0.15 });
revealEls.forEach(function(el) { observer.observe(el); });

// ── Stat Counter Animation ──
function countUp(el, target) {
  var digits = String(target).length;
  var current = 0;
  var duration = 900;
  var start = performance.now();
  function step(now) {
    var progress = Math.min((now - start) / duration, 1);
    current = Math.floor(progress * target);
    el.textContent = String(current).padStart(digits, '0');
    if (progress < 1) requestAnimationFrame(step);
    else el.textContent = String(target).padStart(digits, '0');
  }
  requestAnimationFrame(step);
}

var statEls = document.querySelectorAll('.stat-num[data-target]');
var statObserver = new IntersectionObserver(function(entries) {
  entries.forEach(function(entry) {
    if (entry.isIntersecting) {
      statEls.forEach(function(el) {
        countUp(el, parseInt(el.getAttribute('data-target'), 10));
      });
      statObserver.disconnect();
    }
  });
}, { threshold: 0.4 });
var statsSection = document.querySelector('.stats-section');
if (statsSection) statObserver.observe(statsSection);

// ── Nav Scroll Effect ──
var nav = document.getElementById('landingNav');
if (nav) {
  window.addEventListener('scroll', function() {
    nav.classList.toggle('scrolled', window.scrollY > 40);
  });
}

// ── Mobile Menu ──
var burger = document.getElementById('landingBurger');
var mobileMenu = document.getElementById('mobileMenu');
if (burger && mobileMenu) {
  burger.addEventListener('click', function() {
    burger.classList.toggle('open');
    mobileMenu.classList.toggle('open');
  });
  mobileMenu.querySelectorAll('a').forEach(function(a) {
    a.addEventListener('click', function() {
      burger.classList.remove('open');
      mobileMenu.classList.remove('open');
    });
  });
}

// ── Smooth Scroll ──
document.querySelectorAll('a[href^="#"]').forEach(function(a) {
  a.addEventListener('click', function(e) {
    var target = document.querySelector(a.getAttribute('href'));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth' });
    }
  });
});
