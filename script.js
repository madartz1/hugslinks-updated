document.querySelectorAll('.menu').forEach(btn=>btn.addEventListener('click',()=>document.querySelector('.navlinks').classList.toggle('open')));
const path=location.pathname.split('/').pop()||'index.html';document.querySelectorAll('.navlinks a').forEach(a=>{if(a.getAttribute('href')===path)a.classList.add('active')});
