const paletteBox = document.getElementById('palette-box');
const searchFilter = document.getElementById('palette-search-filter');

// Add preview of first four or so colors to row
async function getPalettes() {
	fetch(`/user/palettes?filter=${searchFilter.value}`)
		.then(response => response.json())
		.then(data => {
			paletteBox.innerHTML = `
		<div class="palette-row" id="palette-col-headers">
			<p>Name</p>
			<p>Last Edited</p>
			<p></p>
			<p></p>
		</div>`
			for (const palette of data.palettes) {
				const paletteEle = document.createElement('div')
				paletteEle.classList.add('palette-row')
				const name = document.createElement('p')
				name.textContent = palette.name.substring(0, 30)
				const createdAt = document.createElement('p')
				const date = new Date(palette.createdat)
				createdAt.textContent = date.toString().substring(0, 21)
				const edit = document.createElement('a')
				edit.href = `/?palette=${palette.id}`
				edit.textContent = 'Edit'
				const del = document.createElement('a')
				del.addEventListener('click', async evt => {
					await fetch(`/user/palettes/${palette.id}`, {
						method: 'DELETE'
					})
					paletteEle.remove()
				})
				del.textContent = 'Delete'
				paletteEle.append(name, createdAt, edit, del)
				paletteBox.appendChild(paletteEle)
			}
		})
}
getPalettes()

searchFilter.addEventListener('keydown', evt => {
	if (evt.key === 'Enter') {
		getPalettes()
	}
})