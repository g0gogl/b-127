const gallery = document.querySelector('.work-gallery');
const slides = gallery.querySelector('.work-gallery-slides');
const photos = Array.from(slides.querySelectorAll('li'));
const previous = gallery.querySelector('[data-prev]');
const next = gallery.querySelector('[data-next]');
const position = gallery.querySelector('[data-position]');
const original = gallery.querySelector('[data-original]');
let current = 0;

function updateControls(index) {
    current = Math.max(0, Math.min(index, photos.length - 1));
    const path = photos[current].dataset.original;
    position.textContent = `${current + 1} / ${photos.length}`;
    original.href = path;
    original.toggleAttribute('download', path.toLowerCase().endsWith('.svg'));
    original.target = original.hasAttribute('download') ? '_self' : '_blank';
}

function move(direction) {
    const index = (current + direction + photos.length) % photos.length;
    slides.scrollLeft = index * slides.clientWidth;
    updateControls(index);
}

previous.addEventListener('click', () => move(-1));
next.addEventListener('click', () => move(1));
slides.addEventListener('scroll', () => {
    if (slides.clientWidth) updateControls(Math.round(slides.scrollLeft / slides.clientWidth));
}, { passive: true });
gallery.querySelector('.work-gallery-controls').hidden = false;
