const filters = document.querySelector('.archive-filters');
const buttons = Array.from(filters.querySelectorAll('button'));
const works = Array.from(document.querySelectorAll('#works > li'));
const empty = document.querySelector('#archive-empty');
const status = document.querySelector('#filter-status');

function applyFilter(filter) {
    const selected = buttons.find((button) => button.dataset.filter === filter) || buttons[0];
    for (const button of buttons) {
        button.setAttribute('aria-pressed', String(button === selected));
    }

    let visible = 0;
    for (const work of works) {
        const value = selected.dataset.filter;
        const matches = value === 'all' || value === work.dataset.year ||
            (value === 'object' && work.hasAttribute('data-object'));
        work.hidden = !matches;
        visible += Number(matches);
    }
    empty.hidden = visible > 0;
    status.textContent = `작품 ${visible}개`;
}

for (const button of buttons) {
    button.addEventListener('click', () => {
        history.replaceState(null, '', '#' + button.dataset.filter);
        applyFilter(button.dataset.filter);
    });
}

function applyUrlFilter() {
    applyFilter(location.hash.slice(1));
}

filters.hidden = false;
window.addEventListener('hashchange', applyUrlFilter);
applyUrlFilter();
