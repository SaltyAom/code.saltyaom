export function isSafari() {
	const userAgent = navigator.userAgent
	// Check for "Safari" and exclude "Chrome" and "Edge" to avoid false positives
	// as Chrome and Edge's user agents also contain "Safari".
	return /safari/i.test(userAgent) && !/chrome|edge/i.test(userAgent)
}

export async function compressImage(
	file: File,
	quality = 0.825,
	maxWidth = 3240
) {
	const img = await createImageBitmap(file)
	const canvas = document.createElement('canvas')
	const scale = Math.min(maxWidth / img.width, 1)
	canvas.width = img.width * scale
	canvas.height = img.height * scale

	const ctx = canvas.getContext('2d')!
	ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

	const safari = isSafari()

	return new Promise<string>((resolve) => {
		canvas.toBlob(
			(blob) => {
				const fileReader = new FileReader()
				fileReader.onload = function (e) {
					resolve(e.target!.result!.toString())
				}
				fileReader.readAsDataURL(blob!)
			},
			safari ? 'image/jpeg' : 'image/webp',
			quality
		)
	})
}
