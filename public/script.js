const input = document.getElementById("playerName");
const btn = document.getElementById("searchBtn");
const result = document.getElementById("result");

btn.addEventListener("click", search);
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") search();
});

async function search() {
  const name = input.value.trim();
  if (!name) return;

  btn.disabled = true;
  result.innerHTML = '<p class="loading">Searching...</p>';

  try {
    const res = await fetch(`/api/player?name=${encodeURIComponent(name)}`);
    const data = await res.json();

    if (!res.ok) {
      result.innerHTML = `<p class="error">${data.error}</p>`;
      return;
    }

    result.innerHTML = `
      <h2>${data.name}</h2>
      <img src="${data.imageUrl}" alt="${data.name}" />
      <a href="${data.profileUrl}" target="_blank">View on PlaymakerStats</a>
    `;
  } catch (err) {
    result.innerHTML = '<p class="error">Request failed. Is the server running?</p>';
  } finally {
    btn.disabled = false;
  }
}
