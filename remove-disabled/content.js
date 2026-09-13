document
  .querySelectorAll('input[type="checkbox"][disabled]')
  .forEach(cb => {
    cb.disabled = false;
    cb.removeAttribute("disabled");
  });
