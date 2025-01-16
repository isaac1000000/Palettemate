import pg from 'pg';
const { Pool } = pg;
import * as cheerio from 'cheerio'
import { writeFile } from 'fs';

const BANNED_DESCRIPTIONS = [
	'',
	'Assorted',
	'Basic',
	'Color Theory',
	'Landscape',
	'Portrait'
]

export async function getPaintsFromPage(url, cutoff) {
	console.log('getting paints from', url)
	// Lol
	const $ = await cheerio.fromURL(url);
	if (cutoff == null) {
		try {
			const paintBreadcrumbs = JSON.parse($('span#breadcrumbsSchema > script').text())
		} catch (err) {
			const newCutoff = err.message.match(/\d+/g)[0]
			return await getPaintsFromPage(url, newCutoff)
		}
	} else {			
		const paintBreadcrumbs = JSON.parse($('span#breadcrumbsSchema > script').text().slice(0, cutoff))
		let paints = paintBreadcrumbs['offers']['offers'].filter(ele => !ele.name.includes('Set') && !BANNED_DESCRIPTIONS.includes(ele.description))
		return await addPaintData($, paints)
	}
}

async function addPaintData($, paints) {
	console.log('adding additional paint data')
	let addtlData = JSON.parse($('script#__NEXT_DATA__').text());
	addtlData = addtlData.props.pageProps.product
	let skuInfo;

	const newPaints = await Promise.all(paints.map(async paint => {
		const productInfo = addtlData.skUs.filter(sku => sku.sku.itemSku == paint.sku)[0]
		paint.sysid = productInfo['sys.id']
		skuInfo = productInfo.sku
		try {
			paint.imgsrc = skuInfo.swatch.filter(item => item.swatchToFeature === 'SwatchOnly')[0].swatchImages[0].image.file.url;
		} catch {}
		await fetch(`https://api.dickblick.com/blick/page-content/api/v2.0/sku-page/${paint.sysid}`)
			.then(res => res.json())
			.then(data => {
				paint.size = data.sku.attributes.filter(attribute => Object.hasOwn(attribute, 'size'))[0].size;
				try {
					paint.colorfamily = data.sku.swatch.filter(swatch => Object.hasOwn(swatch, 'colorChart') && swatch.colorChart !== null)[0].colorChart.genericColorFamily[0].toLowerCase();
				} catch {}
				const swatch = data.sku.swatch.filter(swatch => Object.hasOwn(swatch, 'pigments'))[0]
				if (swatch) {
					paint.pigments = swatch.pigments.reduce((acc, curr) => {
						return [acc, curr.name.replace('.', '')].join(', ')
					}, '').substring(2)
					paint.cei = swatch.pigments.reduce((acc, curr) => {
						return [acc, curr.cei].join(', ')
					}, '').substring(2)
					paint.lightfastness = swatch.pigments.reduce((acc, curr) => {
						return [acc, curr.permanence].join(' ')
					}, '').split('.')[0].trim()
				}
			})
			.catch (err => {
				console.log('Error', err, 'with paint', paint)
			})
		return paint
	}))

	return newPaints
}

export async function downloadImage(url, filepath) {
	const imgUrl = 'https:' + url
	return await fetch(imgUrl)
		.then(res => res.arrayBuffer())
		.then(buffer => writeFile(filepath, Buffer.from(buffer), ()=>{}))
}