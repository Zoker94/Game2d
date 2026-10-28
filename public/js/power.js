// Công thức LỰC CHIẾN dùng chung cho máy chủ (server/game/util.js require file này) và máy khách (so sánh đồ trong túi).
// Bám theo cách tính sát thương thật (world.damage): công × (1 + thưởng điểm hệ Sức Mạnh/Nội Công) × tầng võ công × chí mạng,
// cộng phần chống chịu (thủ, sinh lực, nội lực). Buff tạm thời không tính. Đánh Boss mạnh hơn thì lực chiến phải cao hơn.
(function (root) {
  const OFF_FX = { pierce: 0.006, double: 0.006, stun: 0.006, freeze: 0.006, poison: 0.003, burn: 0.003, bleed: 0.003, slow: 0.002 };
  const DEF_FX = { dmgred: 0.012, dodge: 0.012, reflect: 0.005, lifesteal: 0.008, regen: 0.04, ccres: 0.003 };
  const sumFx = (fx, W) => { let k = 0; for (const key in W) k += W[key] * ((fx && fx[key]) || 0); return k; };
  // q: { atk, crit, def, hp, mp, bonus (thưởng % võ công từ điểm hệ), skillK (hệ số tầng võ công), fx }
  function calc(q) {
    const fx = q.fx || {};
    const critF = 1 + Math.min(75, q.crit || 0) / 100 * (0.75 + (fx.critdmg || 0) / 100);   // chí mạng x1,75 + bạo kích
    const off = (q.atk || 0) * (1 + (q.bonus || 0)) * (q.skillK || 1) * critF * (1 + sumFx(fx, OFF_FX));
    const def = ((q.def || 0) * 2 + (q.hp || 0) / 4 + (q.mp || 0) / 8) * (1 + sumFx(fx, DEF_FX));
    return Math.round(off * 3 + def);
  }
  const Power = { calc, OFF_FX, DEF_FX };
  if (typeof module !== 'undefined' && module.exports) module.exports = Power; else root.Power = Power;
})(typeof window !== 'undefined' ? window : this);
