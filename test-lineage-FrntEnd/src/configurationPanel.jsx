import { useState, useEffect, useRef } from 'react';
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000';
const USER_ID = 'default_user';

const ConfigurationPanel = ({ onApply, currentHierarchy, availableColumns, fetchColumnsFromQuery, onClearAll }) => {
  const [isOpen, setIsOpen] = useState(true);
  const [panelWidth, setPanelWidth] = useState(300);
  const [isResizing, setIsResizing] = useState(false);
  const [selectedColumns, setSelectedColumns] = useState([]);
  const [orderedColumns, setOrderedColumns] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [queryText, setQueryText] = useState('');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [filterSelections, setFilterSelections] = useState({});
  const [filteredData, setFilteredData] = useState(null);
  const [selectClause, setSelectClause] = useState('');
  const [fromClause, setFromClause] = useState('');
  const [activeColumn, setActiveColumn] = useState(null); 
  const [filterChanged, setFilterChanged] = useState(false);
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);
  const isResizingRef = useRef(isResizing);
  const textareaRef = useRef(null);

  const buildFilterQueryFromSelections = (baseQuery, selections) => {
    const normalizedQuery = baseQuery.trim();
    
    const needsBackticks = (column) => /[^a-zA-Z0-9_]/.test(column);
    const escapeColumn = (column) => needsBackticks(column) ? `\`${column}\`` : column;
    
    const conditions = Object.entries(selections)
      .filter(([_, { values }]) => values && values.length > 0)
      .map(([column, { values }]) => {
        const nullValues = values.filter((v) => v === 'NULL');
        const nonNullValues = values.filter((v) => v !== 'NULL');
        
        const nullCondition = nullValues.length > 0 ? `${escapeColumn(column)} IS NULL` : '';
        const nonNullCondition = nonNullValues.length > 0 
          ? `${escapeColumn(column)} IN (${nonNullValues.map((v) => `'${v.replace(/'/g, "''")}'`).join(', ')})` 
          : '';
        
        return [nullCondition, nonNullCondition].filter(Boolean).join(' OR ');
      })
      .filter(Boolean);
    
    if (conditions.length === 0) return baseQuery;
    
    const orderByMatch = normalizedQuery.match(/\s+ORDER\s+BY\s+/i);
    const groupByMatch = normalizedQuery.match(/\s+GROUP\s+BY\s+/i);
    const havingMatch = normalizedQuery.match(/\s+HAVING\s+/i);
    const whereMatch = normalizedQuery.match(/\s+WHERE\s+/i);
    
    let insertPosition = normalizedQuery.length;
    
    if (orderByMatch && orderByMatch.index < insertPosition) insertPosition = orderByMatch.index;
    if (groupByMatch && groupByMatch.index < insertPosition) insertPosition = groupByMatch.index;
    if (havingMatch && havingMatch.index < insertPosition) insertPosition = havingMatch.index;
    
    const filterCondition = conditions.join(' AND ');
    const beforeClause = normalizedQuery.substring(0, insertPosition).trim();
    const afterClause = normalizedQuery.substring(insertPosition).trim();
    
    let query;
    if (whereMatch) {
      query = `${beforeClause} AND (${filterCondition})`;
    } else {
      query = `${beforeClause} WHERE (${filterCondition})`;
    }
    
    if (afterClause) query += ` ${afterClause}`;
    
    return query;
  };

useEffect(() => {
  let hasRun = false;
  
  const loadAndApplySavedSettings = async () => {
    if (hasRun) return;
    hasRun = true;
    
    try {
      console.log('Fetching settings from server for user:', USER_ID);
      const response = await fetch(`${API_BASE}/api/user-settings/${USER_ID}`);
      
      if (response.status === 404) {
        console.log('No saved settings found');
        return;
      }
      
      if (!response.ok) {
        throw new Error('Failed to fetch settings');
      }
      
      const settings = await response.json();
      
      if (!settings || !settings.queryText) {
        console.log('No valid settings found');
        return;
      }
      
      setIsLoadingSettings(true);
      console.log('Loading saved settings from database:', settings);
      
      setQueryText(settings.queryText);
      
      const columns = await fetchColumnsFromQuery(settings.queryText);
      
      if (Array.isArray(columns) && columns.length > 0) {
        if (settings.selectClause) setSelectClause(settings.selectClause);
        if (settings.fromClause) setFromClause(settings.fromClause);
        
        const hasFilters = settings.filterSelections && 
                          Object.keys(settings.filterSelections).length > 0 &&
                          Object.values(settings.filterSelections).some(f => f.values && f.values.length > 0);
        
        let dataToApply = null;
        
        if (hasFilters) {
          console.log('Re-applying saved filters:', settings.filterSelections);
          setFilterSelections(settings.filterSelections);
          
          const filterQuery = buildFilterQueryFromSelections(
            settings.queryText,
            settings.filterSelections
          );
          
          console.log('Executing filter query on mount:', filterQuery);
          const filteredColumns = await fetchColumnsFromQuery(filterQuery);
          
          if (filteredColumns.length > 0 && window.lastQueryResult?.rows?.length > 0) {
            dataToApply = {
              columns: filteredColumns,
              rows: window.lastQueryResult.rows
            };
            setFilteredData(dataToApply);
            console.log('Filters re-applied successfully');
          }
        }
        
        if (settings.selectedColumns) {
          setSelectedColumns(settings.selectedColumns);
        }
        if (settings.orderedColumns) {
          setOrderedColumns(settings.orderedColumns);
        }
        
        if (settings.orderedColumns && settings.orderedColumns.length > 0) {
          setTimeout(() => {
            console.log('Auto-applying saved configuration...');
            
            const finalDataToApply = dataToApply || (window.lastQueryResult ? {
              columns: columns,
              rows: window.lastQueryResult.rows
            } : null);
            
            onApply(settings.orderedColumns, finalDataToApply);
            setIsLoadingSettings(false);
          }, 500);
        } else {
          setIsLoadingSettings(false);
        }
        
        console.log('Settings loaded and applied successfully');
      } else {
        setIsLoadingSettings(false);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
      setIsLoadingSettings(false);
    }
  };
  
  loadAndApplySavedSettings();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

  useEffect(() => {
    const savedSettings = localStorage.getItem('lineageAppSettings');
    if (!savedSettings) {
      setSelectedColumns(currentHierarchy || []);
      setOrderedColumns(currentHierarchy || []);
    }
  }, [currentHierarchy]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 300)}px`;
    }
  }, [queryText]);

  useEffect(() => {
    isResizingRef.current = isResizing;
  }, [isResizing]);

  const handleToggle = () => setIsOpen(!isOpen);

  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    const handleMove = (e) => {
      if (!isResizingRef.current) return;
      const newWidth = Math.min(Math.max(e.clientX, 200), 600);
      setPanelWidth(newWidth);
    };
    
    const handleUp = () => {
      if (isResizingRef.current) {
        setIsResizing(false);
      }
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      const filterDropdown = document.querySelector('[data-filter-dropdown]');
      const activeDropdown = document.querySelector('[data-active-dropdown]');
      
      if (
        showFilterDropdown &&
        filterDropdown &&
        !filterDropdown.contains(event.target) &&
        (!activeDropdown || !activeDropdown.contains(event.target))
      ) {
        setShowFilterDropdown(false);
        setActiveColumn(null);
      }
    };

    if (showFilterDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showFilterDropdown]);

  const handleCheckboxChange = (column) => {
    setSelectedColumns((prev) =>
      prev.includes(column) ? prev.filter((c) => c !== column) : [...prev, column]
    );
    setOrderedColumns((prev) => {
      if (prev.includes(column)) {
        return prev.filter((c) => c !== column);
      } else {
        return [...prev, column].filter((c) => selectedColumns.includes(c) || c === column);
      }
    });
  };

  const handleDragStart = (e, index) => {
    e.dataTransfer.setData('text/plain', index);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    const dragIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (dragIndex === dropIndex) return;

    const newOrder = [...orderedColumns];
    const [draggedItem] = newOrder.splice(dragIndex, 1);
    newOrder.splice(dropIndex, 0, draggedItem);
    setOrderedColumns(newOrder);
  };

  const handleApply = () => {
    onApply(orderedColumns, filteredData);
  };

  const handleSave = async () => {
    const settings = {
      queryText,
      selectedColumns,
      orderedColumns,
      filterSelections,
      selectClause,
      fromClause,
      filteredData,
      savedAt: new Date().toISOString()
    };
    
    try {
      const response = await fetch(`${API_BASE}/api/user-settings/${USER_ID}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save settings');
      }
      
      const result = await response.json();
      alert(' Settings saved successfully! Available on all machines.');
      console.log('Settings saved to database:', result);
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert(' Failed to save settings: ' + error.message);
    }
  };

  const handleClearSettings = async () => {
  if (window.confirm('Are you sure you want to clear all saved settings?')) {
    try {
      const response = await fetch(`${API_BASE}/api/user-settings/${USER_ID}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete settings');
      }
      
      setQueryText('');
      setSelectedColumns([]);
      setOrderedColumns([]);
      setFilterSelections({});
      setSelectClause('');
      setFromClause('');
      setFilteredData(null);
      setActiveColumn(null);
      setShowFilterDropdown(false);
      setSearchTerm('');
      
      if (onClearAll) {
        onClearAll();
      }
      
      alert(' All settings cleared from database!');
    } catch (error) {
      console.error('Failed to clear settings:', error);
      alert(' Failed to clear settings: ' + error.message);
    }
  }
};

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
  };

  const parseQuery = (query) => {
    const normalizedQuery = query.replace(/\s+/g, ' ').trim();
    const cleanedQuery = normalizedQuery.replace(/;$/, '');
    
    const selectMatch = cleanedQuery.match(/SELECT\s+(.*?)\s+FROM/i);
    const fromMatch = cleanedQuery.match(/FROM\s+(.*?)(?:\s+WHERE|\s+GROUP\s+BY|\s+ORDER\s+BY|$)/i);
    
    if (selectMatch && fromMatch) {
      return {
        selectClause: selectMatch[1].trim(),
        fromClause: fromMatch[1].trim()
      };
    }
    
    console.warn('Could not parse query, using defaults');
    return {
      selectClause: '*',
      fromClause: 'lineage_table'
    };
  };

  const handleQuerySubmit = async () => {
    const { selectClause, fromClause } = parseQuery(queryText);
    const columns = await fetchColumnsFromQuery(queryText);
    if (Array.isArray(columns) && columns.length > 0) {
      setSelectClause(selectClause);
      setFromClause(fromClause);
      setFilterSelections({});
      setFilteredData(null);
      setSelectedColumns([]);
      setOrderedColumns([]);
      setActiveColumn(null);
      setShowFilterDropdown(false);
      setFilterChanged(false);
    } else {
      alert('Syntax Error, Please check your query');
      setSelectClause('');
      setFromClause('');
    }
  };

  const handleFilterColumnSelect = async (column, event) => {
    console.log('Selecting filter column:', column);
    const newSelections = {
      ...filterSelections,
      [column]: filterSelections[column] ? { ...filterSelections[column], showValues: !filterSelections[column].showValues }  : { showValues: true, values: [] },
    };
    setFilterSelections(newSelections);
    console.log('New filter selections:', newSelections);

    if (newSelections[column].showValues) {
      const rect = event.currentTarget.getBoundingClientRect();
      const offset = 10; 
      setActiveColumn({
        column,
        left: rect.left + rect.width + offset,
        top: rect.top
      });
      console.log('Opening nested dropdown for column:', column, 'at position:', {
        left: rect.left + rect.width + offset,
        top: rect.top
      });
    } else {
      setActiveColumn(null);
      console.log('Executing filter query for column:', column);
      const query = buildFilterQuery(newSelections);
      try {
        const columns = await fetchColumnsFromQuery(query);
        if (columns.length > 0 && window.lastQueryResult?.rows?.length > 0) {
          const newFilteredData = { columns, rows: window.lastQueryResult.rows };
          setFilteredData(newFilteredData);
        } else {
          alert('Filter query returned no results. Please check the filter values or query.');
        }
      } catch (error) {
        warn('Error executing filter query. Please check the console for details.');
      }
    }
  };

  const handleResetFilters = async () => {
  if (!selectClause || !fromClause) {
    alert('Please submit a valid query first to reset filters.');
    return;
  }

  const baseQuery = `SELECT ${selectClause} FROM ${fromClause}`;
  console.log('Reset Filters clicked. Restoring base query:', baseQuery);

  try {
    const columns = await fetchColumnsFromQuery(baseQuery);
    if (columns.length > 0 && window.lastQueryResult?.rows?.length > 0) {
      const newFilteredData = { columns, rows: window.lastQueryResult.rows };
      setFilteredData(newFilteredData);
      setFilterSelections({});
      setFilterChanged(false);
      setSelectedColumns(columns);
      setOrderedColumns(columns);
      setShowFilterDropdown(false);
      setActiveColumn(null);
      onApply(columns, newFilteredData);
    } else {
      alert('Reset query returned no results. Please check the query or data.');
    }
  } catch (error) {
    console.error('Error resetting filter query:', error);
    alert('Error resetting filter query. See console for details.');
  }
};


  const handleFilterValueChange = (column, value) => {
    console.log('Changing filter value for column:', column, 'value:', value);
    const newSelections = { ...filterSelections };
    setFilterChanged(true);
    const currentValues = newSelections[column]?.values || [];
    newSelections[column] = {
      showValues: true,
      values: currentValues.includes(value) ? currentValues.filter((v) => v !== value) : [...currentValues, value],
    };
    console.log('New filter selections after value change:', newSelections);
    setFilterSelections(newSelections);
  };

  const buildFilterQuery = (selections) => {
    if (!selectClause || !fromClause) {
      alert('Please submit a valid query first to enable filters.');
      return '';
    }

    const needsBackticks = (column) => {
      return /[^a-zA-Z0-9_]/.test(column);
    };

    const escapeColumn = (column) => {
      return needsBackticks(column) ? `\`${column}\`` : column;
    };

    const conditions = Object.entries(selections)
      .filter(([_, { values }]) => values.length > 0)
      .map(([column, { values }]) => {
        const nullValues = values.filter((v) => v === 'NULL');
        const nonNullValues = values.filter((v) => v !== 'NULL');

        const nullCondition = nullValues.length > 0 
          ? `${escapeColumn(column)} IS NULL` 
          : '';
        
        const nonNullCondition = nonNullValues.length > 0 
          ? `${escapeColumn(column)} IN (${nonNullValues.map((v) => `'${v.replace(/'/g, "''")}'`).join(', ')})` 
          : '';
        return [nullCondition, nonNullCondition].filter(Boolean).join(' OR ');
      })
      .filter(Boolean);

    if (conditions.length === 0) {
      return queryText;
    }

    const normalizedQuery = queryText.trim();

    const orderByMatch = normalizedQuery.match(/\s+ORDER\s+BY\s+/i);
    const groupByMatch = normalizedQuery.match(/\s+GROUP\s+BY\s+/i);
    const havingMatch = normalizedQuery.match(/\s+HAVING\s+/i);
    const whereMatch = normalizedQuery.match(/\s+WHERE\s+/i);

    let insertPosition = normalizedQuery.length;
    let foundClause = null;

    if (orderByMatch && orderByMatch.index < insertPosition) {
      insertPosition = orderByMatch.index;
      foundClause = 'ORDER BY';
    }
    if (groupByMatch && groupByMatch.index < insertPosition) {
      insertPosition = groupByMatch.index;
      foundClause = 'GROUP BY';
    }
    if (havingMatch && havingMatch.index < insertPosition) {
      insertPosition = havingMatch.index;
      foundClause = 'HAVING';
    }

    const filterCondition = conditions.join(' AND ');

    let query;
    if (whereMatch) {
      const beforeClause = normalizedQuery.substring(0, insertPosition).trim();
      const afterClause = normalizedQuery.substring(insertPosition).trim();
      
      query = `${beforeClause} AND (${filterCondition})`;
      if (afterClause) {
        query += ` ${afterClause}`;
      }
    } else {
      const beforeClause = normalizedQuery.substring(0, insertPosition).trim();
      const afterClause = normalizedQuery.substring(insertPosition).trim();
      
      query = `${beforeClause} WHERE (${filterCondition})`;
      if (afterClause) {
        query += ` ${afterClause}`;
      }
    }

    console.log('Built filter query:', query);
    return query;
  };

  const handleFilterApply = () => {
    setShowFilterDropdown(false);
    setSelectedColumns(availableColumns);
    setOrderedColumns(availableColumns);
    setFilterChanged(false)
  };

const handleFilterCancel = async () => {
  setShowFilterDropdown(false);
  setActiveColumn(null);

  if (filterChanged) {
    if (!selectClause || !fromClause) {
      alert('Please submit a valid query first to reset filters.');
      return;
    }

    const baseQuery = `SELECT ${selectClause} FROM ${fromClause}`;
    console.log('Cancel clicked. Resetting filter query to base:', baseQuery);

    try {
      const columns = await fetchColumnsFromQuery(baseQuery);
      if (columns.length > 0 && window.lastQueryResult?.rows?.length > 0) {
        const newFilteredData = { columns, rows: window.lastQueryResult.rows };
        setFilteredData(newFilteredData);
      } else {
        alert('Reset query returned no results. Please check the query or data.');
      }
    } catch (error) {
      console.error('Error resetting filter query:', error);
      alert('Error resetting filter query. See console for details.');
    }
  } else {
    console.log('Cancel clicked. No changes detected. Query remains unchanged.');
  }

  setFilterSelections({});
  setFilterChanged(false);
};


  const getColumnValues = (column) => {
    const rows = filteredData?.rows || window.lastQueryResult?.rows || [];
    const values = [...new Set(rows.map((row) => (row[column] === null ? 'NULL' : row[column]?.toString())))]
      .filter(Boolean)
      .sort((a, b) => (a === 'NULL' ? -1 : b === 'NULL' ? 1 : a.localeCompare(b)));
    return values.length > 0 ? values : [];
  };

  const filteredColumns = filteredData?.columns || availableColumns.filter((column) =>
    column.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        width:isOpen ? `${panelWidth}px` : '50px',
        height: '100%',
        background: '#f0f0f0',
        transition: 'width 0.3s',
        overflow: 'visible',
        zIndex: 1000,
        borderRight: '1px solid #ccc',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <button
        onClick={handleToggle}
        style={{
          position: 'absolute',
          top: '10px',
          right: '25px',
          padding: '10px',
          background: '#ffffffff',
          border: '1px solid #ccc',
          borderRadius: '4px',
          fontSize: '14px',
          cursor: 'pointer',
          color: '#666',
          width: '24px',
          height: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {isOpen ? '×' : '☰'}
      </button>

      {isOpen && (
        <>
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '15px',
              paddingBottom: '110px',
              boxSizing: 'border-box',
            }}
          >
            <h2 style={{ fontSize: '18px', marginBottom: '15px', color: '#333', fontWeight: 'bold' }}>
              Configuration Panel
            </h2>

            {isLoadingSettings && (
              <div style={{ 
                padding: '8px', 
                background: '#fff3cd', 
                border: '1px solid #ffc107', 
                borderRadius: '4px', 
                marginBottom: '10px',
                fontSize: '13px',
                color: '#856404'
              }}>
                 Loading saved settings...
              </div>
            )}

            <div style={{ marginBottom: '20px' }}>
              <label
                htmlFor="queryInput"
                style={{ fontWeight: 'bold', fontSize: '14px', display: 'block', marginBottom: '5px', color: '#333' }}
              >
                Write SQL Query
              </label>
              <textarea
                id="queryInput"
                ref={textareaRef}
                value={queryText}
                onChange={(e) => setQueryText(e.target.value)}
                rows={4}
                placeholder="SELECT * FROM your_table"
                style={{
                  width: '100%',
                  padding: '10px',
                  fontSize: '14px',
                  borderRadius: '4px',
                  border: '1px solid #ccc',
                  resize: 'vertical',
                  minHeight: '80px',
                  maxHeight: '150px',
                  boxSizing: 'border-box',
                  background: '#ffffffff',
                  color: '#333',
                }}
              />
              <div style={{ display: 'flex', gap: '5px', marginTop: '5px', justifyContent: 'flex-end' }}>
                <button
                  onClick={handleQuerySubmit}
                  title="Submit Query"
                  style={{
                    height: '36px',
                    width: '36px',
                    background: '#ffffffff',
                    color: '#666',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    fontSize: '16px',
                    cursor: 'pointer',
                    padding: '0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  ✓
                </button>
                <button
                  onClick={() => {
                    if (!selectClause || !fromClause) {
                      alert('Please submit a valid query first to enable filters.');
                      return;
                    }
                    setShowFilterDropdown(!showFilterDropdown);
                  }}
                  title="Select fields to filter"
                  style={{
                    height: '36px',
                    width: '36px',
                    background: '#ffffffff',
                    color: '#666',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    fontSize: '12px',
                    cursor: 'pointer',
                    padding: '0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M2 2V4H14V2H2ZM4 8H12V6H4V8ZM6 12H10V10H6V12Z" fill="#666"/>
                  </svg>
                </button>
                <button
                  onClick={handleResetFilters}
                  title="Reset Filters"
                  style={{
                    height: '36px',
                    width: '36px',
                    background: '#ffffffff',
                    color: '#666',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    fontSize: '16px',
                    cursor: 'pointer',
                    padding: '0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  ⟳
                </button>
              </div>
            </div>

            {showFilterDropdown && (
              <div
              data-filter-dropdown
                style={{
                  position: 'absolute',
                  top: '250px',
                  left: '250px',
                  background: '#f0f0f0',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  zIndex: 1001,
                  width: '250px',
                  maxHeight: '400px',
                  overflowY: 'auto',
                  padding: '10px',
                }}
              >
                {availableColumns.map((column) => (
                  <div key={column} style={{ marginBottom: '5px', position: 'relative' }}>
                    <div
                      onClick={(e) => handleFilterColumnSelect(column, e)}
                      style={{
                        cursor: 'pointer',
                        padding: '4px 8px',
                        color: '#333',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: filterSelections[column]?.showValues ? '#e0e0e0' : '#f0f0f0',
                        borderRadius: '4px',
                      }}
                    >
                      <span>{column}</span>
                      <span style={{ color: '#666' }}>&#x25B6;</span>
                    </div>
                  </div>
                ))}
                <div style={{ textAlign: 'right', marginTop: '10px', display: 'flex', gap: '5px', justifyContent: 'flex-end' }}>
                  <button
                    onClick={handleFilterCancel}
                    style={{
                      padding: '4px 10px',
                      background: '#ffffffff',
                      color: '#333',
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleFilterApply}
                    style={{
                      padding: '4px 10px',
                      background: '#ffffffff',
                      color: '#333',
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px',
                    }}
                  >
                    Apply Filters
                  </button>
                </div>
              </div>
            )}

            {activeColumn && filterSelections[activeColumn.column]?.showValues && (
              <div
               data-active-dropdown
                style={{
                  position: 'absolute',
                  top: `${activeColumn.top}px`,
                  left: `${activeColumn.left}px`,
                  background: '#f0f0f0',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  zIndex: 1002,
                  width: '200px',
                  maxHeight: '300px',
                  overflowY: 'auto',
                  padding: '10px',
                }}
              >
                {getColumnValues(activeColumn.column).map((value) => (
                  <label key={value} style={{ display: 'block', margin: '5px 0', color: '#333' }}>
                    <input
                      type="checkbox"
                      checked={filterSelections[activeColumn.column]?.values.includes(value)}
                      onChange={() => handleFilterValueChange(activeColumn.column, value)}
                      style={{ marginRight: '8px' }}
                    />
                    {value === 'NULL' ? 'NULL' : value}
                  </label>
                ))}
                <div style={{ position: 'sticky', bottom: '0', background: '#f0f0f0', paddingTop: '10px' }}>
                  <button
                    onClick={() => handleFilterColumnSelect(activeColumn.column)}
                    style={{
                      padding: '4px 8px',
                      background: '#ffffffff',
                      color: '#666',
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      width: '100%',
                    }}
                  >
                    OK
                  </button>
                </div>
              </div>
            )}

            <h3 style={{ fontSize: '14px', margin: '5px 0', color: '#333' }}>Select Fields</h3>
            <div style={{ marginBottom: '20px' }}>
              <input
                type="text"
                placeholder="search fields..."
                value={searchTerm}
                onChange={handleSearch}
                style={{
                  width: '95%',
                  padding: '8px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  fontSize: '14px',
                  marginBottom: '10px',
                  background: '#ffffffff',
                  color: '#333',
                }}
              />
              {filteredColumns.map((column) => (
                <label
                  key={column}
                  style={{
                    display: 'block',
                    margin: '5px 0',
                    fontSize: '13px',
                    color: '#333',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedColumns.includes(column)}
                    onChange={() => handleCheckboxChange(column)}
                    style={{ marginRight: '8px' }}
                  />
                  {column}
                </label>
              ))}
            </div>

            <div>
              <h3 style={{ fontSize: '14px', marginBottom: '10px', color: '#333' }}>Drag to Order</h3>
              {orderedColumns.map((column, index) => (
                <div
                  key={column}
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, index)}
                  style={{
                    padding: '8px',
                    marginBottom: '5px',
                    background: '#f0f0f0',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    cursor: 'move',
                    fontSize: '13px',
                    color: '#333',
                  }}
                >
                  <span style={{ marginRight: '10px', color: '#666' }}>L{index + 1}</span>
                  <span style={{ flex: 1 }}>{column}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ 
            position: 'sticky', 
            bottom: 0,         
            left: 0, 
            right: 0,
            width: '100%', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '8px', 
            padding: '15px',    
            paddingTop: '10px', 
            boxSizing: 'border-box',
            background: '#f0f0f0',  
            marginTop: 'auto'    
          }}>
          <div style={{display: 'flex', gap: '8px' }}>
            <button 
              onClick={handleApply} 
              style={{ 
                padding: '10px 20px',
                background: '#fff',  
                color: '#333',      
                border: '1px solid #ccc',  
                borderRadius: '4px', 
                cursor: 'pointer', 
                fontWeight: 'bold', 
                flex: 1,
                fontSize: '14px' 
              }}
            >
              Apply
            </button>
            <button 
              onClick={handleSave} 
              title="Save current settings for next session"
              style={{ 
                padding: '10px 20px', 
                background: '#fff',  
                color: '#333',       
                border: '1px solid #ccc',  
                borderRadius: '4px', 
                cursor: 'pointer', 
                fontWeight: 'bold', 
                flex: 1,
                fontSize: '14px'  
              }}
            >
               Save
            </button>
          </div>
            <button 
              onClick={handleClearSettings} 
              title="Clear all saved settings"
              style={{ 
                padding: '8px 12px',
                background: '#fff',     
                color: '#333',        
                border: '1px solid #ccc',  
                borderRadius: '4px', 
                cursor: 'pointer', 
                fontSize: '12px',
                fontWeight: 'normal'
              }}
            >
            Clear Saved Settings
          </button>
        </div>
        </>
      )}
      {isOpen && (
        <div
          onMouseDown={handleMouseDown}
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: '5px',
            height: '100%',
            cursor: 'col-resize',
            backgroundColor: 'transparent',
            zIndex: 1001,
          }}
        />
        )}
    </div>
  );
};

export default ConfigurationPanel;