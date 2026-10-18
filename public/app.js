const list = document.querySelector('#tasks');
const message = document.querySelector('#message');
let tasks = [];
let filter = 'all';
async function api(path = '', options = {}) {
  const response = await fetch('/api/tasks' + path, { ...options, headers: { 'Content-Type': 'application/json' } });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Something went wrong. Please try again.');
  return result;
}
function render() {
  list.replaceChildren();
  const visible = tasks.filter(task => filter === 'all' || (filter === 'done' ? task.completed : !task.completed));
  document.querySelector('#count').textContent = `${tasks.filter(task => !task.completed).length} to do`;
  document.querySelector('#empty').hidden = visible.length > 0;
  for (const task of visible) {
    const row = document.createElement('li');
    row.className = task.completed ? 'task completed' : 'task';
    const label = document.createElement('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = Boolean(task.completed);
    checkbox.addEventListener('change', async () => {
      checkbox.disabled = true;
      try {
        const updated = await api('/' + task.id, { method: 'PATCH', body: JSON.stringify({ completed: checkbox.checked }) });
        tasks = tasks.map(item => item.id === task.id ? updated : item);
        message.textContent = '';
        render();
      } catch (error) { checkbox.checked = Boolean(task.completed); checkbox.disabled = false; message.textContent = error.message; }
    });
    const title = document.createElement('span');
    title.textContent = task.title;
    label.append(checkbox, title);
    const remove = document.createElement('button');
    remove.className = 'remove';
    remove.textContent = '×';
    remove.setAttribute('aria-label', `Delete ${task.title}`);
    remove.addEventListener('click', async () => {
      remove.disabled = true;
      try { await api('/' + task.id, { method: 'DELETE' }); tasks = tasks.filter(item => item.id !== task.id); message.textContent = ''; render(); }
      catch (error) { remove.disabled = false; message.textContent = error.message; }
    });
    row.append(label, remove);
    list.append(row);
  }
}
document.querySelector('#task-form').addEventListener('submit', async event => {
  event.preventDefault();
  const input = document.querySelector('#title');
  const button = document.querySelector('#add');
  button.disabled = true;
  try {
    const task = await api('', { method: 'POST', body: JSON.stringify({ title: input.value }) });
    tasks.unshift(task);
    input.value = '';
    message.textContent = '';
    render();
    input.focus();
  } catch (error) { message.textContent = error.message; }
  finally { button.disabled = false; }
});
for (const button of document.querySelectorAll('[data-filter]')) button.addEventListener('click', () => {
  filter = button.dataset.filter;
  for (const item of document.querySelectorAll('[data-filter]')) { item.classList.toggle('selected', item === button); item.setAttribute('aria-pressed', String(item === button)); }
  render();
});
api().then(result => { tasks = result; render(); }).catch(error => { document.querySelector('#count').textContent = 'Offline'; message.textContent = error.message; });
