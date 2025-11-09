import { useEffect, useState, useRef, type CSSProperties } from 'react'

import domToImage from 'dom-to-image'
import { Image, ArrowDownToLine, Brush, Minus, X, Square } from 'lucide-react'

import {
	createHighlighter,
	type Highlighter,
	type LanguageRegistration
} from 'shiki'
import { useLocalStorage } from 'react-use'
import * as Popover from '@radix-ui/react-popover'
import { z } from 'zod'

import { defaultCode, languages, themes } from './constant'
import { isLight } from './utils/luma'
import { compressImage, isSafari } from './utils/compress'
import clsx from 'clsx'

const languageRegistrationSchema = z.object({
	name: z.string().min(1),
	scopeName: z.string().min(1),
	patterns: z.array(z.unknown()).optional(),
	repository: z.record(z.string(), z.unknown()).optional()
})

const numericInputCodec = z.codec(
	z.string().regex(/^[0-9]+(\.[0-9]{1,2})?$/),
	z.number().positive(),
	{
		decode: (str) => Number(str),
		encode: (num) => num.toString()
	}
)

const httpUrlSchema = z.url().refine(
	(url) => {
		const parsed = new URL(url)
		return parsed.protocol === 'http:' || parsed.protocol === 'https:'
	},
	{ message: 'URL must use http:// or https://' }
)

export default function ShikiEditor() {
	const [code, setCode] = useLocalStorage('code', defaultCode)
	const [html, setHtml] = useState('')
	const [backgroundColor, setBackgroundColor] = useState('')

	const codeRef = useRef<HTMLDivElement>(null)
	const fileElementRef = useRef<HTMLInputElement>(null)
	const highlighterRef = useRef<Highlighter | null>(null)

	const [language, setLanguage] = useLocalStorage<string>('language')
	const [theme, setTheme] = useLocalStorage<string>('theme')
	const [font, setFont] = useLocalStorage<string>('font')
	const [scale, setScale] = useLocalStorage<number>('scale')
	const [spacing, setSpacing] = useLocalStorage<number>('spacing')
	const [blur, setBlur] = useLocalStorage<number>('blur')
	const [layout, setLayout] = useLocalStorage<number>('layout', 1)
	const [title, setTitle] = useLocalStorage<string>('title')
	const [background, setBackground] = useLocalStorage<string>('background')

	const [colorScheme, setColorScheme] = useLocalStorage<'light' | 'dark'>(
		'color-scheme',
		'dark'
	)

	const [showNotice, setShowNotice] = useLocalStorage<boolean>(
		'show-notice',
		true
	)

	const [customLanguageUrl, setCustomLanguageUrl] = useState('')
	const [isLoadingCustomLang, setIsLoadingCustomLang] = useState(false)
	const [showCustomLangInput, setShowCustomLangInput] = useState(false)
	const [highlighterReady, setHighlighterReady] = useState(false)
	const [customLanguageName, setCustomLanguageName] = useLocalStorage<
		string | null
	>('custom-language-name', null)

	useEffect(() => {
		const initHighlighter = async () => {
			if (highlighterRef.current) return

			const initialLang = language ?? 'tsx'
			const initialTheme = theme ?? 'catppuccin-latte'

			const highlighter = await createHighlighter({
				themes: [initialTheme],
				langs:
					customLanguageName && initialLang === customLanguageName
						? ['tsx']
						: [initialLang]
			})

			highlighterRef.current = highlighter
			setHighlighterReady(true)
		}

		initHighlighter()
		// only run once on mount, theme/language are intentionally captured from initial state
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	useEffect(() => {
		if (highlighterReady && highlighterRef.current && customLanguageName) {
			const loadedLangs = highlighterRef.current.getLoadedLanguages()
			if (!loadedLangs.includes(customLanguageName)) {
				setCustomLanguageName(null)
				if (language === customLanguageName) {
					setLanguage('tsx')
				}
			}
		}
	}, [
		highlighterReady,
		customLanguageName,
		language,
		setCustomLanguageName,
		setLanguage
	])

	useEffect(() => {
		const highlight = async () => {
			if (!highlighterRef.current || !highlighterReady) return

			const currentLang = language ?? 'tsx'
			const currentTheme = theme ?? 'catppuccin-latte'

			const loadedLangs = highlighterRef.current.getLoadedLanguages()
			const loadedThemes = highlighterRef.current.getLoadedThemes()

			if (!loadedLangs.includes(currentLang)) {
				console.warn(
					`Language ${currentLang} not loaded, falling back to tsx`
				)
				setLanguage('tsx')
				return
			}

			try {
				if (!loadedThemes.includes(currentTheme)) {
					// shiki's loadTheme accepts string but types only allow specific literals
					// @ts-ignore
					await highlighterRef.current.loadTheme(currentTheme)
				}

				const html = highlighterRef.current.codeToHtml(
					code ? code + ' ' : '',
					{
						lang: currentLang,
						theme: currentTheme
					}
				)

				const value = html.match(/background-color:#([a-zA-Z0-9]{6})/gs)
				if (!value) return

				const color = value[0].replace('background-color:', '')
				setBackgroundColor(color)
				setColorScheme(isLight(color) ? 'light' : 'dark')

				setHtml(html)
			} catch (error) {
				console.error('Highlighting error:', error)
			}
		}

		highlight()
	}, [language, code, theme, setColorScheme, highlighterReady, setLanguage])

	useEffect(() => {
		if (theme) return

		const systemPrefersDark = window.matchMedia(
			'(prefers-color-scheme: dark)'
		).matches

		setTheme(systemPrefersDark ? 'catppuccin-mocha' : 'catppuccin-latte')
	}, [theme, setTheme])

	useEffect(() => {
		if (colorScheme === 'dark')
			document.documentElement.classList.add('dark')
		else document.documentElement.classList.remove('dark')
	}, [colorScheme])

	const loadCustomLanguage = async () => {
		if (customLanguageUrl === '' || highlighterRef.current === null) {
			return
		}

		const urlValidation = httpUrlSchema.safeParse(customLanguageUrl)
		if (urlValidation.success === false) {
			const firstIssue = urlValidation.error.issues[0]
			alert(
				`Invalid URL: ${
					firstIssue !== undefined && firstIssue.message !== undefined
						? firstIssue.message
						: 'Please enter a valid URL (e.g., https://example.com/language.json)'
				}`
			)
			return
		}

		setIsLoadingCustomLang(true)
		try {
			const response = await fetch(urlValidation.data)
			if (response.ok === false) {
				throw new Error(
					`Failed to fetch: ${response.status} ${response.statusText}`
				)
			}

			const rawData = await response.json()
			const langValidation = languageRegistrationSchema.safeParse(rawData)

			if (langValidation.success === false) {
				const firstIssue = langValidation.error.issues[0]
				throw new Error(
					`Invalid tmLanguage.json format: ${
						firstIssue !== undefined &&
						firstIssue.message !== undefined
							? firstIssue.message
							: 'missing required fields'
					}`
				)
			}

			await highlighterRef.current.loadLanguage(
				langValidation.data as LanguageRegistration
			)
			setLanguage(langValidation.data.name)
			setCustomLanguageName(langValidation.data.name)
			setCustomLanguageUrl('')
			setShowCustomLangInput(false)
		} catch (error) {
			console.error('Error loading custom language:', error)
			alert(
				`Failed to load custom language: ${
					error instanceof Error ? error.message : 'Unknown error'
				}`
			)
		} finally {
			setIsLoadingCustomLang(false)
		}
	}

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
					<section className="zoom-sm border border-neutral-200 dark:border-neutral-700 rounded-2xl overflow-hidden">
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
									backgroundImage: `url(${
										background ??
										'/images/target-for-love.webp'
									})`,
									backgroundSize: 'cover',
									backgroundRepeat: 'no-repeat',
									scale: scale ?? 1.25
								}}
							/>

							<section
								className={clsx(
									'relative text-lg font-mono px-4 pb-4 rounded-2xl shadow-xl',
									layout === 1 ? 'pt-4' : 'pt-1'
								)}
								style={
									Object.assign(
										{
											backgroundColor
										},
										font
											? {
													// css custom properties are not in CSSProperties type
													// @ts-ignore
													'--font-mono': font
											  }
											: {}
									) as CSSProperties
								}
							>
								{layout === 2 && (
									<header className="relative flex items-center py-1 -mx-4 mb-1 px-3">
										<input
											type="text"
											placeholder="code.saltyaom"
											value={title ?? ''}
											onChange={(e) =>
												setTitle(e.target.value)
											}
											className="w-full text-center text-sm bg-transparent outline-none text-neutral-500/65 placeholder:text-neutral-500/65 dark:text-neutral-300/65 dark:placeholder:text-neutral-300/65"
										/>
									</header>
								)}

								{layout === 3 && (
									<header className="relative flex items-center py-1 -mx-4 mb-1 px-3">
										<div
											className="absolute left-3 size-3.5 rounded-full"
											style={{
												backgroundColor: '#FF605C'
											}}
										/>
										<div
											className="absolute left-8.5 size-3.5 rounded-full"
											style={{
												backgroundColor: '#FFBD44'
											}}
										/>
										<div
											className="absolute left-14 size-3.5 rounded-full"
											style={{
												backgroundColor: '#00CA4E'
											}}
										/>

										<input
											type="text"
											placeholder="code.saltyaom"
											value={title ?? ''}
											onChange={(e) =>
												setTitle(e.target.value)
											}
											className="w-full text-center text-sm bg-transparent outline-none text-neutral-500/65 placeholder:text-neutral-500/65 dark:text-neutral-300/65 dark:placeholder:text-neutral-300/65"
										/>
									</header>
								)}

								{layout === 4 && (
									<header className="relative flex items-center py-1 -mx-4 mb-1 px-3">
										<X
											className="absolute right-3.5 dark:text-neutral-300/80"
											size={16}
											strokeWidth={1.5}
										/>
										<Square
											className="absolute right-12 dark:text-neutral-300/80"
											size={12}
											strokeWidth={1.75}
										/>
										<Minus
											className="absolute right-20 dark:text-neutral-300/80"
											size={16}
											strokeWidth={1.5}
										/>

										<input
											type="text"
											placeholder="code.saltyaom"
											value={title ?? ''}
											onChange={(e) =>
												setTitle(e.target.value)
											}
											className="w-full text-center text-sm bg-transparent outline-none text-neutral-500/65 placeholder:text-neutral-500/65 dark:text-neutral-300/65 dark:placeholder:text-neutral-300/65"
										/>
									</header>
								)}

								<textarea
									className="absolute z-20 w-full h-full caret-blue-400 text-transparent bg-transparent resize-none border-0 outline-0 whitespace-nowrap overflow-hidden"
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

								<div className="overflow-hidden">
									<div
										className="relative z-10 p-0 whitespace-nowrap overflow-hidden pointer-events-none *:min-w-xs *:min-h-15.5 **:font-normal! *:bg-transparent! *:rounded-2xl **:not-italic! **:font-mono!"
										dangerouslySetInnerHTML={{
											__html: html
										}}
									/>

									<div
										className="absolute z-0 inset-1/2  -translate-1/2 w-7xl h-full bg-center bg-no-repeat scale-100 pointer-events-none"
										style={{
											backgroundImage: `url(${
												background ??
												'/images/target-for-love.webp'
											})`,
											backgroundSize: 'cover',
											backgroundRepeat: 'no-repeat',
											scale: scale ?? 1.25,
											filter: `blur(${blur ?? 10}px)`,
											opacity: 0.2
										}}
									/>
								</div>
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

				<label className="flex flex-col w-12">
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
						onChange={(e) => {
							const value = e.target.value
							if (value === '') {
								setScale(undefined)
								return
							}
							const result = numericInputCodec.safeDecode(value)
							if (result.success === true) {
								setScale(result.data)
							}
						}}
					/>
				</label>

				<label className="flex flex-col w-14">
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
						onChange={(e) => {
							const value = e.target.value
							if (value === '') {
								setSpacing(undefined)
								return
							}
							const result = numericInputCodec.safeDecode(value)
							if (result.success === true) {
								setSpacing(result.data)
							}
						}}
					/>
				</label>

				<label className="flex flex-col w-10">
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
						onChange={(e) => {
							const value = e.target.value
							if (value === '') {
								setBlur(undefined)
								return
							}
							const result = numericInputCodec.safeDecode(value)
							if (result.success === true) {
								setBlur(result.data)
							}
						}}
					/>
				</label>

				<label className="flex flex-col -translate-y-0.5 mr-2">
					<span className="text-xs text-neutral-400 font-light">
						Layout
					</span>
					<div className="flex items-center mt-0.5 gap-0.5">
						{new Array(4).fill(0).map((_, index) => (
							<button
								key={index}
								className={clsx(
									'flex justify-center items-center size-5.5 min-w-5.5 interact:scale-110 rounded-lg transition-all cursor-pointer',
									layout === index + 1
										? 'bg-sky-400/10 text-sky-400 scale-100!'
										: 'text-neutral-400 dark:text-neutral-500'
								)}
								onClick={() => setLayout(index + 1)}
								title={`Layout ${index + 1}`}
								aria-label={`Layout ${index + 1}`}
							>
								{index + 1}
							</button>
						))}
					</div>
				</label>

				<label className="flex flex-col">
					<span className="text-xs text-neutral-400 font-light appearance-none">
						Language
					</span>
					<div className="flex items-center gap-1">
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
							{customLanguageName && (
								<option
									key={customLanguageName}
									value={customLanguageName}
								>
									{customLanguageName} (custom)
								</option>
							)}
						</select>
						<Popover.Root
							open={showCustomLangInput}
							onOpenChange={setShowCustomLangInput}
						>
							<Popover.Trigger asChild>
								<button
									className="text-neutral-400 interact:text-sky-400 transition-colors"
									title="Custom Language"
									aria-label="Toggle Custom Language Input"
								>
									+
								</button>
							</Popover.Trigger>
							<Popover.Portal>
								<Popover.Content
									side="top"
									align="start"
									sideOffset={8}
									className="p-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-xl min-w-72 z-50"
								>
									<div className="flex items-center justify-between mb-2">
										<span className="text-xs text-neutral-400 font-light">
											Custom Language URL
											{isLoadingCustomLang &&
												' (loading...)'}
										</span>
										<Popover.Close asChild>
											<button
												className="text-neutral-400 interact:text-neutral-700 dark:interact:text-neutral-300 transition-colors"
												aria-label="Close"
											>
												<X
													size={14}
													strokeWidth={1.5}
												/>
											</button>
										</Popover.Close>
									</div>
									<input
										type="text"
										name="customLanguageUrl"
										placeholder="https://example.com/lang.json"
										value={customLanguageUrl}
										className="w-full px-2 py-1 text-neutral-700 dark:text-neutral-300 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg outline-none focus:border-sky-400 transition-colors placeholder:text-neutral-400"
										onChange={(e) =>
											setCustomLanguageUrl(e.target.value)
										}
										onKeyDown={(e) => {
											if (e.key === 'Enter') {
												e.preventDefault()
												loadCustomLanguage()
											}
										}}
										onBlur={() => {
											if (customLanguageUrl === '') {
												return
											}

											const urlValidation =
												httpUrlSchema.safeParse(
													customLanguageUrl
												)
											if (
												urlValidation.success === true
											) {
												loadCustomLanguage()
											}
										}}
										disabled={isLoadingCustomLang}
										autoFocus
									/>
								</Popover.Content>
							</Popover.Portal>
						</Popover.Root>
					</div>
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
						// brave browser detection property is not in standard navigator type
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
