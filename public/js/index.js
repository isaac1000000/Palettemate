const urlParams = new URLSearchParams(window.location.search);

const paletteNameInput = document.getElementById('palette-name')

const paintBox = document.getElementById('paint-box');
fetch('/current-palette?' + urlParams.toString())
	.then((response) => response.json())
	.then((data) => {
		paletteNameInput.value = data.palette.name ?? '';
		for (const paint of data.palette.paints) {
			addPaint(paint)
		}
	})
	.catch(err => console.error(err));

// Put into an actual element
let totalCost = 0;
const paletteCost = document.getElementById('palette-cost')

function addPaint(paint) {
	const paintElement = document.createElement('div');
	paintElement.classList.add('paint')
	const swatch = document.createElement('div');
	swatch.classList.add('swatch')
	paintElement.appendChild(swatch)
	const paintImg = document.createElement('img');
	paintImg.classList.add('swatch-img')
	paintImg.alt = paint.color;
	paintImg.src = paint.imgurl;
	swatch.appendChild(paintImg);
	const delBtn = document.createElement('button');
	delBtn.classList.add('paint-del-btn')
	delBtn.addEventListener('click', async evt => {
		await fetch('/current-palette', {
			method: 'DELETE',
			headers: {'Content-Type':'application/json'},
			body: JSON.stringify({ paint: paint.id })
		})
		paintElement.remove()
		totalCost -= Number(paint.price);
		paletteCost.textContent = '$' + totalCost.toFixed(2)
		//window.addEventListener('beforeunload', preventUnload)
	})
	const delBtnImg = document.createElement('img')
	delBtnImg.src = '/img/svg/minus.svg'
	delBtn.appendChild(delBtnImg)
	paintElement.appendChild(delBtn)
	createAddtlInfoEle(paint, swatch);
	paintBox.appendChild(paintElement);
	totalCost += Number(paint.price);
	paletteCost.textContent = '$' + totalCost.toFixed(2)
}

function createAddtlInfoEle(paint, swatch) {
	const infoDiv = document.createElement('a')
	infoDiv.href = paint.srcurl;
	infoDiv.target = '_blank';
	infoDiv.classList.add('hidden', 'paint-info-box')
	const addtlInfo = document.createElement('div')
	addtlInfo.classList.add('paint-info')
	addtlInfo.innerHTML = `
		${paint.color} : ${paint.quality} quality<br>
		${paint.size} : $${paint.price}<br>
		Pigments: ${paint.pigments} (${paint.cei})<br>
		Lightfastness: ${paint.lightfastness}
	`
	swatch.parentElement.addEventListener('mouseenter', () => {
		infoDiv.classList.remove('hidden')
		swatch.classList.add('hidden')
	})
	swatch.parentElement.addEventListener('mouseleave', () => {
		infoDiv.classList.add('hidden')
		swatch.classList.remove('hidden')
})
	infoDiv.appendChild(addtlInfo)
	swatch.insertAdjacentElement('afterend', infoDiv)
}

const addBox = document.getElementById('add-box')
const addBtn = document.getElementById('add-btn')
const addPop = document.getElementById('add-popup')
const addPopItems = document.getElementById('add-popup-items')
const addPopExitBtn = document.getElementById('add-popup-exit-btn')
const addPopBackBtn = document.getElementById('add-popup-back-btn')
let popupPage = 0;
let formActive = false;
addBtn.addEventListener('click', evt => {
	addPop.classList.remove('hidden');
	if (formActive) {
		return
	}
})

const saveBtn = document.getElementById('save-btn')
const savedNotif = document.getElementById('saved-notif')
let lastSavedTimeout = null;
saveBtn.addEventListener('click', async evt => {
	await fetch('/current-palette', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ do: 'save-palette', name: paletteNameInput.value ?? 'My Palette' }),
		redirect: 'follow'
	})
		.then(res => {
			if (res.status === 401) {
				window.location.replace('/login');
			}
			else {
				lastSavedTimeout = displayNotif(savedNotif, 'Saved palette!', lastSavedTimeout)
				//window.removeEventListener('beforeunload', preventUnload)
			}
		})
		.catch(err => console.error('Error saving palette:', err))
})

const openBtn = document.getElementById('open-btn')
openBtn.addEventListener('click', evt => {
	const paintLinks = [...document.querySelectorAll('.paint-info-box')]
	paintLinks.forEach(link => {
		window.open(link.href, '_blank')
	})
})

addPopBackBtn.addEventListener('click', evt => {
	if (addPopItems.firstChild.classList.contains('paint-btn')) {
		addPopItems.innerHTML = '';
		addPopItems.append(...colorButtonsCache)
		addPopBackBtn.classList.add('hidden')
	} else {
		addPopItems.innerHTML = ''
		addPopItems.append(...paintButtonsCache)
	}
})

addPopExitBtn.addEventListener('click', evt => {
	addPop.classList.add('hidden');
	addPopItems.innerHTML = '';
	addPopBackBtn.classList.add('hidden');
	colorButtonsCache.forEach(btn => addPopItems.appendChild(btn))
})

let paintButtonsCache;

document.querySelectorAll('.color-btn').forEach(btn => {
	btn.addEventListener('click', async evt => {
		const target = evt.target
		addPopItems.innerHTML = '';

		fetch(`/paints?colorfamily=${target.value}`)
			.then(res => res.json())
			.then(data => {
				addPopBackBtn.classList.remove('hidden');
				for (const paint of data.paints) {
					const paintBtn = document.createElement('button');
					paintBtn.classList.add('paint-btn')
					const textEle = document.createElement('p')
					textEle.classList.add('paint-btn-name')
					textEle.textContent = `${paint.brand} ${paint.color}`
					paintBtn.appendChild(textEle);
					paintBtn.style.backgroundImage = `url(${paint.imgurl})`;
					const paintBtnInfo = document.createElement('div');
					paintBtnInfo.innerHTML = `
						Pigments: ${paint.pigments} (${paint.cei})<br>
						Lightfastness: ${paint.lightfastness}.
					`
					paintBtnInfo.classList.add('paint-btn-info', 'hidden')
					paintBtn.appendChild(paintBtnInfo)
					paintBtn.addEventListener('mouseenter', evt2 => paintBtnInfo.classList.remove('hidden'))
					paintBtn.addEventListener('mouseleave', evt2 => paintBtnInfo.classList.add('hidden'))
					const sizes = createSizeOptions(paint)
					paintBtn.addEventListener('click', async evt2 => {
						addPopItems.innerHTML = '';
						sizes.forEach(size => addPopItems.appendChild(size))
					})
					addPopItems.appendChild(paintBtn);
					paintButtonsCache = document.querySelectorAll('.paint-btn');
				}
			})
			.catch(err => console.error(err))
	})
})
const colorButtonsCache = document.querySelectorAll('.color-btn');

const addedPaintNotif = document.getElementById('added-notif')
function createSizeOptions(paint) {
	const sizeBtns = []
	let lastTimeout = null;
	for (const [id, info] of Object.entries(paint.size)) {
		const sizeBtn = document.createElement('button')
		sizeBtn.classList.add('text-only', 'size-btn')
		sizeBtn.textContent = `${paint.color} ${info[0]}: $${info[1]}`
		sizeBtn.value = id
		sizeBtn.addEventListener('click', async evt => {
			const addResponse = await fetch('/current-palette', {
				method: 'POST',
				headers: {'Content-Type':'application/json'},
				body: JSON.stringify({ paint: id, do: 'add-paint' })
			})
			const addedPaint = await addResponse.json()
			addPaint(addedPaint);
			lastTimeout = displayNotif(addedPaintNotif, 'Added paint!', lastTimeout)
			//window.addEventListener('beforeunload', preventUnload)
		})
		sizeBtns.push(sizeBtn)
	}
	return sizeBtns
}

const newPaletteButton = document.getElementById('new-palette-btn')
newPaletteButton.addEventListener('click', evt => {
	location.href = '/?palette=new'
})

// This is so lazy lol
function displayNotif(notif, message, lastTimeout) {
	notif.textContent = message;
	if ([...notif.classList].includes('hidden')) {
		notif.classList.remove('hidden')
	} else {
		clearTimeout(lastTimeout)
	}
	return setTimeout(() => notif.classList.add('hidden'), 2000)
}

function preventUnload() {
	event.preventDefault();
	event.returnValue = "You've made unsaved changes, are you sure you want to leave this page?"
}