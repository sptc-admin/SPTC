"use client"

import * as React from "react"

type SearchableSelectProps = Omit<React.ComponentProps<"input">, "onChange" | "value"> & {
  value?: string
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void
  children?: React.ReactNode
  searchable?: boolean
}

type SelectOption = {
  value: string
  label: string
  disabled?: boolean
}

function extractText(node: React.ReactNode): string {
  if (node == null) return ""
  if (typeof node === "string") return node
  if (typeof node === "number") return String(node)
  if (Array.isArray(node)) return node.map(extractText).join("")
  if (React.isValidElement(node)) {
    const { children } = node.props as { children?: React.ReactNode }
    if (children) return extractText(children)
  }
  return ""
}

function collectOptions(children: React.ReactNode, list: SelectOption[]) {
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return
    if (child.type === "option") {
      const optProps = child.props as {
        value?: string | number
        children?: React.ReactNode
        disabled?: boolean
      }
      const value = optProps.value ?? ""
      const label = extractText(optProps.children)
      list.push({
        value: String(value),
        label,
        disabled: Boolean(optProps.disabled),
      })
      return
    }
    const nested = (child.props as { children?: React.ReactNode }).children
    if (nested) collectOptions(nested, list)
  })
}

export function SearchableSelect({
  className,
  children,
  value,
  onChange,
  placeholder,
  searchable = true,
  ...props
}: SearchableSelectProps) {
  const listId = React.useId()
  const [inputValue, setInputValue] = React.useState("")
  const [isFocused, setIsFocused] = React.useState(false)

  const options = React.useMemo(() => {
    const list: SelectOption[] = []
    collectOptions(children, list)
    return list
  }, [children])

  const placeholderOption = options.find((opt) => opt.value === "")
  const derivedPlaceholder =
    placeholder ?? placeholderOption?.label ?? "Select an option"

  const currentValue = value == null ? "" : String(value)
  const matchedValueOption = options.find(
    (opt) => opt.value === currentValue && opt.value !== ""
  )

  React.useEffect(() => {
    if (!isFocused) {
      setInputValue(matchedValueOption?.label ?? "")
    }
  }, [matchedValueOption, isFocused])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    setInputValue(raw)

    const matched =
      options.find((opt) => opt.label === raw && opt.value !== "") ??
      options.find((opt) => opt.value === raw && opt.value !== "")

    const nextValue = matched ? matched.value : ""

    const syntheticEvent = {
      ...e,
      target: { ...e.target, value: nextValue },
      currentTarget: { ...e.currentTarget, value: nextValue },
    }
    onChange?.(syntheticEvent as unknown as React.ChangeEvent<HTMLSelectElement>)
  }

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true)
    if (searchable) {
      setInputValue("")
    }
    props.onFocus?.(e)
  }

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(false)

    const matched = options.find(
      (opt) => opt.label.toLowerCase() === inputValue.toLowerCase() && opt.value !== ""
    )
    if (matched) {
      setInputValue(matched.label)
      if (matched.value !== currentValue) {
        const syntheticEvent = {
          ...e,
          target: { ...e.target, value: matched.value },
          currentTarget: { ...e.currentTarget, value: matched.value },
        }
        onChange?.(syntheticEvent as unknown as React.ChangeEvent<HTMLSelectElement>)
      }
    } else {
      setInputValue(matchedValueOption?.label ?? "")
    }

    props.onBlur?.(e)
  }

  if (!searchable) {
    const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      onChange?.(e)
    }

    return (
      <select
        className={className}
        value={currentValue}
        onChange={handleSelectChange}
        disabled={props.disabled}
      >
        <option value="" disabled={!placeholderOption}>
          {derivedPlaceholder}
        </option>
        {options
          .filter((opt) => opt.value !== "")
          .map((opt) => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </option>
          ))}
      </select>
    )
  }

  return (
    <>
      <input
        {...props}
        className={className}
        value={inputValue}
        placeholder={derivedPlaceholder}
        list={listId}
        autoComplete="off"
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
      />
      <datalist id={listId}>
        {options
          .filter((opt) => !opt.disabled && opt.value !== "")
          .map((opt) => (
            <option key={`${opt.value}-${opt.label}`} value={opt.label} />
          ))}
      </datalist>
    </>
  )
}
