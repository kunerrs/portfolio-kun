// Intersection Observer for active section tracking
const sections = document.querySelectorAll('section[id]');
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const sectionId = entry.target.getAttribute('id');
            window.dispatchEvent(new CustomEvent('section-visible', { detail: { section: sectionId } }));
        }
    });
}, { threshold: 0.3 });

sections.forEach(section => observer.observe(section));

document.addEventListener('alpine:init', () => {
    window.addEventListener('section-visible', (e) => {
        Alpine.store('navigation').activeSection = e.detail.section;
    });
});
