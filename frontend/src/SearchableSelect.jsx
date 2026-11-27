import React, { useState, useEffect, useRef, useMemo } from 'react';

export function SearchableSelect({
  options = [],
  value,
  onChange,
  placeholder = 'Type to search...',
  emptyOption = 'All options',
  required = false,
  className = '',
  loading = false,
  error = ''
}) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const containerRef = useRef(null);
  const listRef = useRef(null);

  // Find currently selected item
  const selectedOption = useMemo(() => {
    return (options || []).find(o => String(o.id) === String(value));
  }, [options, value]);

  // Keep display text synchronized with selected value
  useEffect(() => {
    if (selectedOption) {
      setQuery(selectedOption.name + (selectedOption.hindi_name ? ` (${selectedOption.hindi_name})` : ''));
    } else if (!value) {
      setQuery('');
    }
  }, [value, selectedOption]);

  // Filter options based on user typing
  const filtered = useMemo(() => {
    const list = options || [];
    if (!query) return list;
    if (selectedOption && query === selectedOption.name + (selectedOption.hindi_name ? ` (${selectedOption.hindi_name})` : '')) {
      return list;
    }
    const q = query.toLowerCase().trim();
    return list.filter(o => {
      const nameMatch = o.name?.toLowerCase().includes(q);
      const hindiMatch = o.hindi_name && o.hindi_name.toLowerCase().includes(q);
      const distMatch = o.district && o.district.toLowerCase().includes(q);
      const stateMatch = o.state && o.state.toLowerCase().includes(q);
      return nameMatch || hindiMatch || distMatch || stateMatch;
    });
  }, [options, query, selectedOption]);

  // Handle clicking outside to close
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        if (selectedOption) {
          setQuery(selectedOption.name + (selectedOption.hindi_name ? ` (${selectedOption.hindi_name})` : ''));
        } else if (!value) {
          setQuery('');
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [selectedOption, value]);

  // Auto scroll highlighted item into view
  useEffect(() => {
    if (isOpen && listRef.current && highlightIndex >= 0) {
      const items = listRef.current.querySelectorAll('.searchable-select-option');
      if (items[highlightIndex]) {
        items[highlightIndex].scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightIndex, isOpen]);

  function handleSelect(option) {
    if (option) {
      onChange(option.id);
      setQuery(option.name + (option.hindi_name ? ` (${option.hindi_name})` : ''));
    } else {
      onChange('');
      setQuery('');
    }
    setIsOpen(false);
    setHighlightIndex(-1);
  }

  function handleKeyDown(e) {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
        return;
      }
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex(prev => (prev < filtered.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex(prev => (prev > 0 ? prev - 1 : filtered.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightIndex >= 0 && highlightIndex < filtered.length) {
        handleSelect(filtered[highlightIndex]);
      } else if (filtered.length > 0) {
        handleSelect(filtered[0]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  }

  return (
    <div className={`searchable-select ${className}`} ref={containerRef}>
      {/* Hidden input to support HTML form validation if required */}
      <input
        type="text"
        style={{ position: 'absolute', opacity: 0, height: 0, width: 0, pointerEvents: 'none' }}
        value={value || ''}
        required={required}
        onChange={() => { }}
        tabIndex={-1}
      />
      <div className="searchable-select-input-wrap">
        <input
          type="text"
          className="searchable-select-input"
          placeholder={placeholder}
          value={query}
          onFocus={() => setIsOpen(true)}
          onChange={e => {
            setQuery(e.target.value);
            setIsOpen(true);
            setHighlightIndex(-1);
            if (!e.target.value) {
              onChange('');
            }
          }}
          onKeyDown={handleKeyDown}
          autoComplete="off"
        />
        {value ? (
          <button
            type="button"
            className="searchable-select-clear"
            title="Clear selection"
            onClick={(e) => {
              e.stopPropagation();
              handleSelect(null);
            }}
          >
            ✕
          </button>
        ) : (
          <span className="searchable-select-arrow" onClick={() => setIsOpen(!isOpen)}>▾</span>
        )}
      </div>

      {isOpen && (
        <ul className="searchable-select-dropdown" role="listbox" ref={listRef}>
          {!required && emptyOption && (
            <li
              className={`searchable-select-option ${!value ? 'selected' : ''}`}
              onClick={() => handleSelect(null)}
            >
              <span>{emptyOption}</span>
            </li>
          )}
          {filtered.length > 0 ? (
            filtered.map((opt, idx) => {
              const isSel = String(opt.id) === String(value);
              const isHl = idx === highlightIndex;
              return (
                <li
                  key={opt.id}
                  className={`searchable-select-option ${isSel ? 'selected' : ''} ${isHl ? 'highlighted' : ''}`}
                  onClick={() => handleSelect(opt)}
                >
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: isSel ? 700 : 500 }}>
                      {opt.name}
                      {opt.hindi_name && (
                        <span style={{ marginLeft: '6px', color: '#167449', fontSize: '0.85em', fontWeight: 600 }}>
                          ({opt.hindi_name})
                        </span>
                      )}
                    </span>
                    {(opt.district || opt.state) && (
                      <small style={{ color: '#688273', fontSize: '0.75rem', marginTop: '2px' }}>
                        {[opt.district, opt.state].filter(Boolean).join(', ')}
                      </small>
                    )}
                  </div>
                  {isSel && <span style={{ color: '#167449', fontWeight: 800 }}>✓</span>}
                </li>
              );
            })
          ) : loading ? (
            <li className="searchable-select-empty">Loading available options...</li>
          ) : error ? (
            <li className="searchable-select-empty" style={{ color: '#dc2626' }}>
              Failed to load options: {error}
            </li>
          ) : (!options || options.length === 0) ? (
            <li className="searchable-select-empty">No options available</li>
          ) : (
            <li className="searchable-select-empty">
              No matching crops or markets found for "{query}"
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
