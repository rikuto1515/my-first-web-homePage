// ===== Utils =====
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

const dayMs = 24 * 60 * 60 * 1000;
const fmtYMD = (d)=> d.toISOString().slice(0,10);

// ===== Header / Nav =====
(() => {
  const toggle = $('.nav-toggle');
  const nav = $('#site-nav');
  toggle?.addEventListener('click', () => {
    const isOpen = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(isOpen));
  });
  $('#year').textContent = String(new Date().getFullYear());
})();

// ===== Availability / Estimator =====
(() => {
  const form = $('#availabilityForm');
  const startEl = form.startAt;
  const endEl = form.endAt;
  const carSel = form.carClass;
  const locationSel = form.location;
  const daysEl = $('#daysEstimate');
  const priceEl = $('#priceEstimate');
  const msg = $('#availabilityMessage');

  // 初期：過去日時を禁止
  const now = new Date();
  const min = new Date(now.getTime() + 60 * 60 * 1000); // 1時間後から
  const minStr = min.toISOString().slice(0,16);
  startEl.min = minStr;
  endEl.min = minStr;

  // 料金表（1日あたり）
  const daily = {
    compact: 5000,
    sedan: 7000,
    minivan: 9000
  };

  function clampEndAfterStart(){
    if (!startEl.value) return;
    const s = new Date(startEl.value);
    const e = new Date(endEl.value || s.getTime() + dayMs);
    if (e <= s) {
      const newEnd = new Date(s.getTime() + dayMs);
      endEl.value = newEnd.toISOString().slice(0,16);
    }
    endEl.min = startEl.value;
  }

  function updateEstimate(){
    const s = startEl.value ? new Date(startEl.value) : null;
    const e = endEl.value ? new Date(endEl.value) : null;
    const cls = carSel.value;

    if (!s || !e || !cls) {
      daysEl.textContent = '-';
      priceEl.textContent = '-';
      return;
    }
    // 日数は切り上げ（24h単位）
    const days = Math.max(1, Math.ceil((e - s) / dayMs));
    const price = days * (daily[cls] ?? 0);
    daysEl.textContent = String(days);
    priceEl.textContent = price.toLocaleString();
  }

  ['change','input'].forEach(ev=>{
    startEl.addEventListener(ev, ()=>{ clampEndAfterStart(); updateEstimate(); });
    endEl.addEventListener(ev, updateEstimate);
    carSel.addEventListener(ev, updateEstimate);
    locationSel.addEventListener(ev, updateEstimate);
  });

  $('#checkAvailabilityBtn').addEventListener('click', async () => {
    if (!form.reportValidity()) return;

    msg.classList.remove('sr-only');
    msg.textContent = '空き状況を確認しています…';

    const payload = {
      location: form.location.value,
      carClass: form.carClass.value,
      startAt: form.startAt.value,
      endAt: form.endAt.value
    };

    try {
      const res = await fetch('/api/availability', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        // 期待するレスポンス例: { available: true, note: "残り2台" }
        msg.textContent = data.available
          ? `空きがあります（${data.note ?? '予約可能'}）`
          : `申し訳ありません、満車です（${data.note ?? ''}）`;
        msg.style.color = data.available ? '#7bd88f' : '#ff6b6b';
      } else {
        // バックエンド未接続でも動くようデモ表示
        msg.textContent = 'デモ応答: 空きがあります（残り2台）';
        msg.style.color = '#7bd88f';
      }
    } catch (e) {
      // オフラインや未実装時のフォールバック
      msg.textContent = 'デモ応答: 空きがあります（残り2台）';
      msg.style.color = '#7bd88f';
    }
  });

  // 初回
  clampEndAfterStart();
  updateEstimate();
})();

// ===== Reservation submit =====
(() => {
  const reserveForm = $('#reservationForm');
  const availabilityForm = $('#availabilityForm');
  const submitBtn = $('#reserveSubmitBtn');
  const statusEl = $('#reserveStatus');
  const dialog = $('#confirmDialog');

  function gatherPayload(){
    const a = availabilityForm;
    const r = reserveForm;
    return {
      // 予約内容
      location: a.location.value,
      carClass: a.carClass.value,
      startAt: a.startAt.value,
      endAt: a.endAt.value,
      // 顧客情報
      name: r.name.value.trim(),
      email: r.email.value.trim(),
      phone: r.phone.value.trim(),
      option: r.option.value || null,
      // 同意
      agree: !!r.agree.checked,
      // 参考：概算料金（日付差から再計算）
      priceEstimate: (() => {
        const s = a.startAt.value ? new Date(a.startAt.value) : null;
        const e = a.endAt.value ? new Date(a.endAt.value) : null;
        const cls = a.carClass.value;
        const daily = { compact:5000, sedan:7000, minivan:9000 };
        if(!s||!e||!cls) return null;
        const days = Math.max(1, Math.ceil((e - s) / (24*60*60*1000)));
        return days * (daily[cls] ?? 0);
      })()
    };
  }

  reserveForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    // 両フォームの必須チェック
    const valid = availabilityForm.reportValidity() && reserveForm.reportValidity();
    if (!valid) return;

    submitBtn.disabled = true;
    statusEl.textContent = '送信中…';

    const payload = gatherPayload();

    try {
      const res = await fetch('/api/reservations', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        // 実API: { reservationId: "ABC123", emailSent: true } を想定
        statusEl.textContent = '';
        dialog.showModal();
        reserveForm.reset();
      } else {
        // バックエンド未実装でもデモ完了にする
        statusEl.textContent = '';
        dialog.showModal();
        reserveForm.reset();
      }
    } catch (err) {
      statusEl.textContent = '通信に失敗しました。回線状況をご確認ください。';
      statusEl.style.color = '#ff6b6b';
    } finally {
      submitBtn.disabled = false;
    }
  });
})();
