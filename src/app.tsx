import { useEffect, useState, useRef, type CSSProperties } from 'react'

import domToImage from 'dom-to-image'
import { Image, ArrowDownToLine, Brush, ChevronDown } from 'lucide-react'

import { codeToHtml } from 'shiki'
import { useLocalStorage } from 'react-use'

import { defaultCode, languages, themes } from './constant'
import { isLight } from './utils/luma'
import { compressImage, isSafari } from './utils/compress'

export default function ShikiEditor() {
	const [code, setCode] = useLocalStorage('code', defaultCode)
	const [html, setHtml] = useState('')

	const codeRef = useRef<HTMLDivElement>(null)
	const fileElementRef = useRef<HTMLInputElement>(null)

	const [language, setLanguage] = useLocalStorage<string>('language')
	const [theme, setTheme] = useLocalStorage<string>('theme')
	const [font, setFont] = useLocalStorage<string>('font')
	const [scale, setScale] = useLocalStorage<number>('scale')
	const [spacing, setSpacing] = useLocalStorage<number>('spacing')
	const [blur, setBlur] = useLocalStorage<number>('blur')
	const [background, setBackground] = useLocalStorage<string>('background')

	const [colorScheme, setColorScheme] = useLocalStorage<'light' | 'dark'>(
		'color-scheme',
		'dark'
	)

	const [showNotice, setShowNotice] = useLocalStorage<boolean>(
		'show-notice',
		true
	)

	useEffect(() => {
		codeToHtml(code ? code + ' ' : '', {
			lang: 'tsx',
			theme: theme ?? 'catppuccin-latte'
		}).then((html) => {
			const value = html.match(/background-color:#([a-zA-Z0-9]{6})/gs)
			if (!value) return

			const color = value[0].replace('background-color:#', '')
			setColorScheme(isLight(color) ? 'light' : 'dark')

			setHtml(
				html.replace(
					/background-color:#([a-zA-Z0-9]{6});/gs,
					'background-color:#$1cc;border:1px solid #$144;'
				)
			)
		})
	}, [code, theme, setColorScheme])

	useEffect(() => {
		if (theme) return

		const systemPrefersDark = window.matchMedia(
			'(prefers-color-scheme: dark)'
		).matches

		setTheme(systemPrefersDark ? 'catppuccin-mocha' : 'catppuccin-latte')
	}, [])

	useEffect(() => {
		if (colorScheme === 'dark')
			document.documentElement.classList.add('dark')
		else document.documentElement.classList.remove('dark')
	}, [colorScheme])

	function saveImage() {
		if (!codeRef.current) return

		domToImage
			.toJpeg(codeRef.current, {
				quality: 1,
				width: codeRef.current.clientWidth * 4,
				height: codeRef.current.clientHeight * 4,
				style: {
					transform: 'scale(4)',
					transformOrigin: 'top left'
				}
			})
			.then((dataUrl) => {
				const link = document.createElement('a')
				link.download = 'code-salt.jpg'
				link.href = dataUrl
				link.click()
			})
	}

	return (
		<>
			<main className="flex justify-center items-center w-full min-h-dvh pt-8 pb-16">
				{!html ? (
					<Brush
						size={36}
						strokeWidth={1}
						className="text-neutral-300 dark:text-neutral-700 animate-pulse"
					/>
				) : (
					<section
						className="zoom-sm border border-neutral-200 dark:border-neutral-700 rounded-2xl overflow-hidden"
					>
						<div
							ref={codeRef}
							className="relative min-w-xs max-w-7xl"
							style={{
								padding: `${spacing || 48}px`
							}}
						>
							<div
								className="absolute inset-1/2 -translate-1/2 w-7xl h-full bg-center bg-no-repeat"
								style={{
									backgroundImage: `url(${background ?? '/images/target-for-love.webp'})`,
									backgroundSize: 'cover',
									backgroundRepeat: 'no-repeat',
									scale: scale ?? 1.25
								}}
							/>

							<section
								className="relative text-lg font-mono rounded-2xl shadow-xl"
								style={
									Object.assign(
										{},
										font
											? {
													// @ts-ignore
													'--font-mono': font
												}
											: {}
									) as CSSProperties
								}
							>
								<div className="relative overflow-hidden rounded-2xl">
									<div
										className="relative z-10 p-0 whitespace-nowrap overflow-hidden pointer-events-none *:min-w-xs *:min-h-15.5 **:font-normal! *:p-4 *:rounded-2xl **:not-italic! **:font-mono!"
										dangerouslySetInnerHTML={{
											__html: html
										}}
									/>

									<div
										className="absolute z-0 inset-1/2  -translate-1/2 w-7xl h-full bg-center bg-no-repeat scale-100 pointer-events-none"
										style={{
											backgroundImage: `url(${background ?? '/images/target-for-love.webp'})`,
											backgroundSize: 'cover',
											backgroundRepeat: 'no-repeat',
											scale: scale ?? 1.25,
											filter: `blur(${blur ?? 10}px)`
										}}
									/>
								</div>

								<textarea
									className="absolute z-10 inset-0 w-full h-full p-4 caret-blue-400 text-transparent bg-transparent resize-none border-0 outline-0 whitespace-nowrap overflow-hidden"
									value={code}
									onChange={(e) => setCode(e.target.value)}
									spellCheck={false}
									onKeyDown={(event) => {
										// handle tab
										if (event.key === 'Tab') {
											event.preventDefault()
											const target = event.currentTarget
											const start = target.selectionStart
											const end = target.selectionEnd
											const newValue =
												target.value.substring(
													0,
													start
												) +
												'\t' +
												target.value.substring(end)

											setCode(newValue)
											// move cursor
											setTimeout(() => {
												target.selectionStart =
													target.selectionEnd =
														start + 1
											}, 0)
										}
									}}
									data-gramm="false"
								/>
							</section>
						</div>
					</section>
				)}
			</main>

			<aside className="fixed z-30 left-1/2 bottom-4 flex items-center gap-4 max-w-[calc(100%-2rem)] p-4 -translate-x-1/2 text-base text-neutral-700 dark:text-neutral-300 bg-neutral-50 dark:bg-neutral-800 rounded-2xl border border-neutral-200 dark:border-neutral-700 shadow-2xl shadow-black/5 overflow-y-hidden overflow-x-auto">
				<button
					className="flex justify-center items-center size-9 min-w-9 interact:bg-sky-400/7.5 interact:text-sky-400 interact:scale-110 rounded-xl transition-all cursor-pointer"
					onClick={() => fileElementRef.current?.click()}
					title="Change Background"
					aria-label="Change Background"
				>
					<Image size={21} strokeWidth={1.5} />
				</button>
				<input
					ref={fileElementRef}
					className="hidden"
					type="file"
					name="background"
					accept="image"
					onInput={async (image) => {
						const file = image.currentTarget.files?.[0]
						if (!file) return

						setBackground(await compressImage(file))
					}}
				/>

				<label className="flex flex-col">
					<span className="text-xs text-neutral-400 font-light">
						Scale
					</span>
					<input
						type="tel"
						name="scale"
						pattern="[0-9]+([.][0-9]{1,2})?"
						placeholder="1.25"
						value={scale ?? ''}
						className="outline-none max-w-16"
						onChange={(e) =>
							setScale(e.target.value as unknown as number)
						}
					/>
				</label>

				<label className="flex flex-col">
					<span className="text-xs text-neutral-400 font-light">
						Spacing
					</span>
					<input
						type="tel"
						name="spacing"
						pattern="[0-9]+([.][0-9]{1,2})?"
						placeholder="48"
						value={spacing ?? ''}
						className="outline-none max-w-16"
						onChange={(e) =>
							setSpacing(e.target.value as unknown as number)
						}
					/>
				</label>

				<label className="flex flex-col">
					<span className="text-xs text-neutral-400 font-light">
						Blur
					</span>
					<input
						type="tel"
						name="blur"
						pattern="[0-9]+([.][0-9]{1,2})?"
						placeholder="10"
						value={blur ?? ''}
						className="outline-none max-w-16"
						onChange={(e) =>
							setBlur(e.target.value as unknown as number)
						}
					/>
				</label>

				<label className="flex flex-col">
					<span className="text-xs text-neutral-400 font-light appearance-none">
						Language
					</span>
					<select
						name="theme"
						value={language ?? 'tsx'}
						className="outline-none appearance-none"
						onChange={(e) => setLanguage(e.target.value)}
					>
						{languages.map((language) => (
							<option key={language} value={language}>
								{language}
							</option>
						))}
					</select>
				</label>

				<label className="flex flex-col">
					<span className="text-xs text-neutral-400 font-light">
						Theme
					</span>
					<select
						name="theme"
						value={theme ?? 'catppuccin-latte'}
						className="outline-none appearance-none"
						onChange={(e) => setTheme(e.target.value)}
					>
						{themes.map((theme) => (
							<option key={theme} value={theme}>
								{theme}
							</option>
						))}
					</select>
				</label>

				<label className="flex flex-col">
					<span className="text-xs text-neutral-400 font-light">
						Font
						{showNotice ===
						// @ts-ignore
						false ? null : typeof navigator?.brave !==
						  'undefined' ? (
							<span>
								{' '}
								(Disable Brave Shield for local font){' '}
								<button
									onClick={() => setShowNotice(false)}
									className="text-neutral-700 dark:text-neutral-300 font-medium cursor-pointer"
								>
									Dismiss
								</button>
							</span>
						) : isSafari() ? (
							<span>
								{' '}
								(Safari doesn't support local font){' '}
								<button
									onClick={() => setShowNotice(false)}
									className="text-neutral-700 dark:text-neutral-300 font-medium cursor-pointer"
								>
									Dismiss
								</button>
							</span>
						) : (
							''
						)}
					</span>
					<input
						type="text"
						name="font"
						placeholder="JetBrains Mono"
						value={font ?? ''}
						className="outline-none"
						onChange={(e) => setFont(e.target.value)}
					/>
				</label>

				<button
					className="flex justify-center items-center size-9 min-w-9 interact:bg-sky-400/7.5 interact:text-sky-400 interact:scale-110 rounded-xl transition-all cursor-pointer"
					onClick={saveImage}
					title="Save"
					aria-label="Save"
				>
					<ArrowDownToLine size={21} strokeWidth={1.5} />
				</button>
			</aside>
		</>
	)
}
