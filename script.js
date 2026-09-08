document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('contact-form');
  const note = document.getElementById('form-note');

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      note.textContent = '문의가 접수되었습니다. 빠른 시일 내에 답변드릴게요. (준비 중인 기능입니다)';
      note.hidden = false;
    });
  }
});
