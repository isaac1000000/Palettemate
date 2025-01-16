const searchFilter = document.getElementById('paint-search-filter');
const paintBox = document.getElementById('paint-box')
const addPaintBtn = document.getElementById('add-paint-btn')
const addPaintPopup = document.getElementById('add-paint-popup')
const addPaintList = document.getElementById('add-paint-list')
const addPaintBox = document.getElementById('add-paint-box')
const addSearchFilter = document.getElementById('add-search-filter')

function getPaints() {
	fetch(`/user/paints?filter=${searchFilter.value}`)
		.then(response => response.json())
		.then(data => {
			paintBox.innerHTML = `
				<div class="paint-row" id="paint-col-headers">
					<p>Color</p>
					<p>Brand</p>
					<p>Type</p>
					<p>Line</p>
					<p>Size</p>
					<p></p>
				</div>
			`
			for (const paint of data.paints) {
				addPaint(paint)
			}
	})
}
getPaints()

function addPaint(paint) {
	const paintEle = document.createElement('div')
	paintEle.classList.add('paint-row')
	const name = document.createElement('p')
	name.textContent = paint.color
	const brand = document.createElement('p')
	brand.textContent = paint.brand
	const type = document.createElement('p')
	type.textContent = paint.type
	const line = document.createElement('p')
	line.textContent = paint.line
	const size = document.createElement('p')
	size.textContent = paint.size
	const remove = document.createElement('a')
	remove.addEventListener('click', async evt => {
		await fetch(`/user/paints/${paint.id}`, {
			method: 'DELETE',
		})
		paintEle.remove()
	})
	remove.textContent = 'Remove'
	paintEle.append(name, brand, type, line, size, remove)
	paintBox.appendChild(paintEle)
}

searchFilter.addEventListener('keydown', async evt => {
	if (evt.key === 'Enter') {
		getPaints()
	}
})

addPaintBtn.addEventListener('click', evt => {
	addPaintPopup.classList.remove('hidden')
})

addPaintPopup.addEventListener('click', evt => addPaintPopup.classList.add('hidden'))
addPaintBox.addEventListener('click', evt => evt.stopPropagation())

// SKU would probably be helpful for quick searches when adding owned paints
const paintsWithInfo = {  };
function getAddPaints() {
	fetch('/paints')
		.then(response => response.json())
		.then(data => {
			for (const paint of data.paints) {
				const paintEle = document.createElement('tr')
				paintEle.classList.add('add-paint-row')
				const name = document.createElement('td')
				name.textContent = paint.color
				const brand = document.createElement('td')
				brand.textContent = paint.brand
				const type = document.createElement('td')
				type.textContent = paint.type
				const line = document.createElement('td')
				line.textContent = paint.line
				const size = document.createElement('td')
				size.textContent = paint.size
				const add = document.createElement('td')
				add.textContent = 'Add'
				add.addEventListener('click', evt => {
					fetch('/user/paints', {
						method: 'POST',
						headers: {'Content-Type':'application/json'},
						body: JSON.stringify({ paint: paint.id })
					})
						.then(() => addPaint(paint))
				})
				paintEle.append(name, brand, type, line, size, add)
				addPaintList.appendChild(paintEle)
				paintsWithInfo[paint.id] = { paint, element: paintEle }
			}
		})
}
getAddPaints()



addSearchFilter.addEventListener('keydown', async evt => {
	if (evt.key === 'Enter') {
		addPaintList.innerHTML = ''
		for (const [id, info] of Object.entries(paintsWithInfo)) {
			const searchKey = [info.paint.color, info.paint.brand, info.paint.type, info.paint.line, info.paint.size]
			if (searchKey.some(ele => ele.toLowerCase().includes(addSearchFilter.value.toLowerCase()))) {
				addPaintList.appendChild(info.element)
			}
		}
	}
})