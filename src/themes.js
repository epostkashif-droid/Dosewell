// Dosewell looks. Each one changes colours (light and dark), background art, type, corner shapes,
// motion and the in-app sounds. The build turns these into CSS; tests check every colour pair for contrast.

const T = (o) => o;

export const THEMES = [
  {
    id: 'lilac', name: 'Lavender', tagline: 'Soft and calm',
    font: 'Jakarta', display: 'Jakarta', radius: 20, zoom: 1, motion: 'float',
    light: T({ bg: '#F6F4FB', surface: '#FFFFFF', ink: '#2A2640', muted: '#676280', line: '#E6E2F1', primary: '#6457C9', 'on-primary': '#FFFFFF', 'primary-soft': '#E9E5FB', mint: '#D9F2E6', 'mint-ink': '#1C6F4E', peach: '#FFE4D4', 'peach-ink': '#9C4420', rose: '#FCDDE4', 'rose-ink': '#A6304F', sky: '#DCEBFC', 'sky-ink': '#27598F', butter: '#FFF1C7', 'butter-ink': '#7A5C00', good: '#7FD3AC', some: '#F3CB67', bad: '#F29BB0' }),
    dark: T({ bg: '#16142A', surface: '#211E38', ink: '#EEEAFB', muted: '#ABA5C6', line: '#343052', primary: '#AEA3F7', 'on-primary': '#1A1640', 'primary-soft': '#2F2B57', mint: '#1D3B30', 'mint-ink': '#93E0BF', peach: '#45291C', 'peach-ink': '#FFC2A2', rose: '#472233', 'rose-ink': '#FFAEC2', sky: '#1E3350', 'sky-ink': '#A9CDFA', butter: '#3F3513', 'butter-ink': '#F4D774', good: '#3E9C74', some: '#B8912E', bad: '#B85A73' }),
    art: 'radial-gradient(60vmax 40vmax at 100% -10%, var(--primary-soft), transparent 70%), radial-gradient(50vmax 34vmax at -10% 30%, var(--sky), transparent 70%)',
    sound: { alarm: { wave: 'sine', gain: .35, notes: [[880, 0, .32], [1175, .18, .32], [1568, .36, .32], [1175, .7, .32], [1568, .88, .4]] }, taken: { wave: 'sine', gain: .22, notes: [[988, 0, .16], [1319, .09, .28]] } },
    extra: ''
  },
  {
    id: 'garden', name: 'Garden', tagline: 'Fresh, round and bouncy',
    font: 'Nunito', display: 'Nunito', radius: 26, zoom: 1, motion: 'bounce',
    light: T({ bg: '#F1F6EE', surface: '#FFFFFF', ink: '#1F2D22', muted: '#566457', line: '#DCE7D7', primary: '#27703F', 'on-primary': '#FFFFFF', 'primary-soft': '#DDEFD9', mint: '#DDF1DA', 'mint-ink': '#22663A', peach: '#FCE7CF', 'peach-ink': '#8E4A12', rose: '#F9E0DC', 'rose-ink': '#A23A2E', sky: '#DDEFEA', 'sky-ink': '#24645A', butter: '#F6F0C4', 'butter-ink': '#6E5A00', good: '#86CF8F', some: '#E9C95A', bad: '#EE9C8F' }),
    dark: T({ bg: '#111A14', surface: '#1B2720', ink: '#E6F1E6', muted: '#A2B5A4', line: '#2D3D32', primary: '#8FD6A5', 'on-primary': '#0E2416', 'primary-soft': '#21382A', mint: '#1E3A27', 'mint-ink': '#9BE3AE', peach: '#3D2A16', 'peach-ink': '#F8C48F', rose: '#3F221E', 'rose-ink': '#F7AEA2', sky: '#183631', 'sky-ink': '#9EDCCF', butter: '#353112', 'butter-ink': '#EAD777', good: '#4C9E5E', some: '#AC9433', bad: '#B0645A' }),
    art: 'radial-gradient(circle at 12px 12px, var(--primary-soft) 3px, transparent 3.5px) 0 0/34px 34px, linear-gradient(180deg, transparent 55%, var(--mint) 100%)',
    sound: { alarm: { wave: 'triangle', gain: .45, notes: [[523, 0, .2], [659, .12, .2], [784, .24, .2], [1047, .36, .3], [784, .62, .2], [1047, .74, .36]] }, taken: { wave: 'triangle', gain: .32, notes: [[659, 0, .12], [988, .07, .12], [1319, .14, .22]] } },
    extra: '.chip,.btn,.tick,.icon-btn,.cell{transition:transform .18s cubic-bezier(.3,1.6,.5,1)}.btn:active,.chip:active,.tick:active,.cell:active{transform:scale(.92)}.cell{border-radius:999px;padding-top:12px}.hero{background:var(--mint)}.hero .ring .t{stroke:var(--surface)}.fab{border-radius:50%}.nav a i{width:44px;height:44px;border-radius:50%}.nav a{gap:0}'
  },
  {
    id: 'sunset', name: 'Sunset', tagline: 'Warm with a classic touch',
    font: 'Jakarta', display: 'Fraunces', radius: 18, zoom: 1, motion: 'glow',
    light: T({ bg: '#FFF5EF', surface: '#FFFFFF', ink: '#3A2420', muted: '#76574F', line: '#F2DED4', primary: '#AE3A0B', 'on-primary': '#FFFFFF', 'primary-soft': '#FDE3D3', mint: '#E0F1E2', 'mint-ink': '#2C6A3E', peach: '#FFE2CC', 'peach-ink': '#93400D', rose: '#FDDCE0', 'rose-ink': '#A22B44', sky: '#E7E4F8', 'sky-ink': '#4A3F98', butter: '#FFEDC2', 'butter-ink': '#7A5600', good: '#8FCB9B', some: '#F2BE5C', bad: '#EF8E9E' }),
    dark: T({ bg: '#1C1210', surface: '#2A1C18', ink: '#FBEDE6', muted: '#C3A79D', line: '#43302A', primary: '#FFA477', 'on-primary': '#3A1404', 'primary-soft': '#4A2A1E', mint: '#1F3624', 'mint-ink': '#A2DDAF', peach: '#4A2C18', 'peach-ink': '#FFC89F', rose: '#4A2028', 'rose-ink': '#FFADBC', sky: '#2C2A4A', 'sky-ink': '#C3BBFA', butter: '#433315', 'butter-ink': '#F6D27C', good: '#4F9461', some: '#B68A33', bad: '#B85566' }),
    art: 'linear-gradient(170deg, var(--primary-soft) 0%, transparent 38%), radial-gradient(70vmax 40vmax at 50% 115%, var(--rose), transparent 70%)',
    sound: { alarm: { wave: 'sine', gain: .4, decay: 1.4, notes: [[784, 0, 1.2], [1175, 0, 1.2, .25], [659, .6, 1.2], [988, .6, 1.2, .25], [784, 1.2, 1.5], [1175, 1.2, 1.5, .25]] }, taken: { wave: 'sine', gain: .28, decay: .9, notes: [[1047, 0, .8], [1568, 0, .8, .3]] } },
    extra: 'h1,h2,.streak .num,.ring b,.dose-txt b{font-family:var(--display);font-weight:650;letter-spacing:-.01em}h1{font-size:30px}.section-h{font-family:var(--font);letter-spacing:.16em}.hero{background:linear-gradient(135deg,var(--surface) 40%,var(--peach))}.card,.dose{border-top:3px solid var(--primary-soft)}.fab{border-radius:18px 18px 18px 4px}'
  },
  {
    id: 'ocean', name: 'Ocean', tagline: 'Cool, crisp and quick',
    font: 'Jakarta', display: 'Jakarta', radius: 14, zoom: 1, motion: 'slide',
    light: T({ bg: '#F0F6FA', surface: '#FFFFFF', ink: '#14293A', muted: '#4E6475', line: '#D8E5EE', primary: '#0B6E99', 'on-primary': '#FFFFFF', 'primary-soft': '#D9EDF7', mint: '#D7F1EC', 'mint-ink': '#11695A', peach: '#FDE8D7', 'peach-ink': '#8F4615', rose: '#FBE0E6', 'rose-ink': '#A12D4A', sky: '#DCE8FB', 'sky-ink': '#2A55A0', butter: '#FFF1C7', 'butter-ink': '#725500', good: '#6CCDB8', some: '#F0C861', bad: '#F09AAE' }),
    dark: T({ bg: '#0C1720', surface: '#14232F', ink: '#E4F0F7', muted: '#9DB4C4', line: '#253846', primary: '#6FC8EE', 'on-primary': '#04202D', 'primary-soft': '#173547', mint: '#123A35', 'mint-ink': '#8DE0CF', peach: '#3E2A1A', 'peach-ink': '#FFC79E', rose: '#41202A', 'rose-ink': '#FFADC0', sky: '#1A2E4E', 'sky-ink': '#A8C6FA', butter: '#3B3313', 'butter-ink': '#F1D573', good: '#2E9884', some: '#A88A2E', bad: '#AE5468' }),
    art: 'radial-gradient(140% 220px at 50% -120px, var(--primary-soft) 0 70%, transparent 71%), radial-gradient(140% 220px at 20% -100px, var(--sky) 0 72%, transparent 73%)',
    sound: { alarm: { wave: 'sine', gain: .4, sweep: true, notes: [[520, 0, .18, 1, 900], [620, .22, .18, 1, 1100], [720, .44, .22, 1, 1300], [520, .9, .18, 1, 900], [720, 1.12, .26, 1, 1300]] }, taken: { wave: 'sine', gain: .3, sweep: true, notes: [[400, 0, .14, 1, 900]] } },
    extra: '.card,.dose,.rec,.cell{box-shadow:0 1px 0 var(--line),0 4px 14px rgba(11,60,90,.06)}.dose{border-left:4px solid var(--sky)}.dose.is-taken{border-left-color:var(--good)}.dose.is-missed{border-left-color:var(--bad)}.dose.is-due{border-left-color:var(--some)}.chip{border-radius:10px}.chip .avatar{border-radius:7px}.nav a i{border-radius:8px}.fab{border-radius:14px}'
  },
  {
    id: 'clear', name: 'Clear', tagline: 'Large, bold and easy to read',
    font: 'Atkinson', display: 'Atkinson', radius: 10, zoom: 1.12, motion: 'none',
    light: T({ bg: '#FFFFFF', surface: '#FFFFFF', ink: '#000000', muted: '#3D3D3D', line: '#8A8A8A', primary: '#0040C1', 'on-primary': '#FFFFFF', 'primary-soft': '#E3EBFF', mint: '#DDF5E3', 'mint-ink': '#0B5A26', peach: '#FFE6CC', 'peach-ink': '#7A3300', rose: '#FFE0E3', 'rose-ink': '#8F0F26', sky: '#E3EBFF', 'sky-ink': '#0B3A9E', butter: '#FFF0B8', 'butter-ink': '#5C4200', good: '#2E9E55', some: '#D9A400', bad: '#D0344E' }),
    dark: T({ bg: '#000000', surface: '#111111', ink: '#FFFFFF', muted: '#CFCFCF', line: '#7A7A7A', primary: '#8FB4FF', 'on-primary': '#000000', 'primary-soft': '#14234A', mint: '#0E2C17', 'mint-ink': '#8EF0AE', peach: '#331C06', 'peach-ink': '#FFC28A', rose: '#3A0A14', 'rose-ink': '#FFA3B4', sky: '#14234A', 'sky-ink': '#B8CEFF', butter: '#2E2400', 'butter-ink': '#FFDF6B', good: '#2E9E55', some: '#C99800', bad: '#D0344E' }),
    art: 'none',
    sound: { alarm: { wave: 'square', gain: .16, notes: [[988, 0, .2], [988, .3, .2], [988, .6, .2], [1319, 1.0, .35]] }, taken: { wave: 'square', gain: .12, notes: [[1319, 0, .12]] } },
    extra: '.card,.dose,.rec,.cell,.chip,.icon-btn{box-shadow:none;border:2px solid var(--line)}.chip[aria-pressed="true"]{border-color:var(--primary)}h1{font-size:30px;letter-spacing:0}h2,h3,b,strong{letter-spacing:0}body{font-weight:400}.dose-txt b{font-size:19px}.muted,.small{font-weight:700}.tick{border-width:3px}'
  }
];

export const THEME_IDS = THEMES.map(t => t.id);
export const getTheme = id => THEMES.find(t => t.id === id) || THEMES[0];

const FONT_STACK = {
  Jakarta: '"Jakarta","Segoe UI",Roboto,system-ui,sans-serif',
  Nunito: '"Nunito","Segoe UI",Roboto,system-ui,sans-serif',
  Fraunces: '"Fraunces",Georgia,"Times New Roman",serif',
  Atkinson: '"Atkinson",Verdana,"Segoe UI",Roboto,system-ui,sans-serif'
};

const tokens = o => Object.entries(o).map(([k, v]) => `--${k}:${v};`).join('');
const shadowLight = '--shadow:0 1px 2px rgba(20,20,40,.05),0 6px 18px rgba(20,20,40,.06);';
const shadowDark = '--shadow:0 1px 2px rgba(0,0,0,.3),0 6px 18px rgba(0,0,0,.25);';

// Animations, chosen by each look's motion style. Every one starts from a visible state.
const MOTION = {
  float: {
    sheet: 'from{transform:translateY(24px);opacity:.6}to{transform:none;opacity:1}', sheetT: '.24s ease-out',
    view: 'from{transform:translateY(8px)}to{transform:none}', viewT: '.28s ease-out',
    taken: '0%{transform:scale(1)}40%{transform:scale(1.22)}100%{transform:scale(1)}', takenT: '.35s ease-out'
  },
  bounce: {
    sheet: '0%{transform:translateY(60px)}60%{transform:translateY(-8px)}80%{transform:translateY(3px)}100%{transform:none}', sheetT: '.42s cubic-bezier(.3,.9,.4,1)',
    view: '0%{transform:scale(.98)}60%{transform:scale(1.01)}100%{transform:none}', viewT: '.32s ease-out',
    taken: '0%{transform:scale(1)}30%{transform:scale(.8)}60%{transform:scale(1.3) rotate(-8deg)}80%{transform:scale(.95) rotate(4deg)}100%{transform:none}', takenT: '.5s ease-out'
  },
  glow: {
    sheet: 'from{transform:scale(.97);opacity:.4}to{transform:none;opacity:1}', sheetT: '.3s ease-out',
    view: 'from{opacity:.5}to{opacity:1}', viewT: '.35s ease-out',
    taken: '0%{box-shadow:0 0 0 0 var(--good)}100%{box-shadow:0 0 0 14px transparent}', takenT: '.6s ease-out'
  },
  slide: {
    sheet: 'from{transform:translateY(100%)}to{transform:none}', sheetT: '.2s cubic-bezier(.2,.8,.2,1)',
    view: 'from{transform:translateX(12px)}to{transform:none}', viewT: '.2s ease-out',
    taken: '0%{box-shadow:0 0 0 0 var(--primary-soft),inset 0 0 0 0 var(--good)}100%{box-shadow:0 0 0 18px transparent,inset 0 0 0 24px transparent}', takenT: '.45s ease-out'
  },
  none: null
};

export function themeCss() {
  let css = '';
  THEMES.forEach((t, i) => {
    const sel = i === 0 ? `:root,:root[data-skin="${t.id}"]` : `:root[data-skin="${t.id}"]`;
    const base = `--font:${FONT_STACK[t.font]};--display:${FONT_STACK[t.display]};--r:${t.radius}px;--zoom:${t.zoom};--art:${t.art};`;
    css += `${sel}{color-scheme:light;${tokens(t.light)}${shadowLight}${base}}\n`;
    const darkSel = i === 0 ? `:root:not([data-theme="light"]),:root[data-skin="${t.id}"]:not([data-theme="light"])` : `:root[data-skin="${t.id}"]:not([data-theme="light"])`;
    css += `@media (prefers-color-scheme: dark){${darkSel}{color-scheme:dark;${tokens(t.dark)}${shadowDark}}}\n`;
    const forced = i === 0 ? `:root[data-theme="dark"],:root[data-skin="${t.id}"][data-theme="dark"]` : `:root[data-skin="${t.id}"][data-theme="dark"]`;
    css += `${forced}{color-scheme:dark;${tokens(t.dark)}${shadowDark}}\n`;
    const m = MOTION[t.motion];
    const scope = i === 0 ? `:root:not([data-skin]) X,:root[data-skin="${t.id}"] X` : `:root[data-skin="${t.id}"] X`;
    const s = x => scope.replace(/X/g, x);
    if (m) {
      css += `@keyframes sheet-${t.id}{${m.sheet}}@keyframes view-${t.id}{${m.view}}@keyframes taken-${t.id}{${m.taken}}\n`;
      css += `${s('.panel')}{animation:sheet-${t.id} ${m.sheetT}}${s('.app.enter>*')}{animation:view-${t.id} ${m.viewT}}${s('.just-taken .tick')}{animation:taken-${t.id} ${m.takenT}}\n`;
    } else css += `${s('.panel')}{animation:none}${s('.bell')}{animation:none}${s('.ring .p')}{transition:none}\n`;
    if (t.extra) css += t.extra.replace(/(^|\})([^{}]+)\{/g, (all, close, sels) => close + sels.split(',').map(x => s(x.trim())).join(',') + '{') + '\n';
  });
  return css;
}

// Colours for the shareable streak picture, from the light palette of the look.
export function shareColors(id) {
  const t = getTheme(id), c = t.light;
  return { frame: c['primary-soft'], card: c.surface, brand: c.primary, ink: c.ink, muted: c.muted, tile: c.butter, tileInk: c['butter-ink'], full: c.good, partial: c.some, none: c.bad, pending: c.line, empty: c.bg, font: FONT_STACK[t.display] };
}
