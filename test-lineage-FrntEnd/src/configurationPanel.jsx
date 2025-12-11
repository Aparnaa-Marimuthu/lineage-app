import { useState, useEffect, useRef } from 'react';

const ConfigurationPanel = ({ onApply, currentHierarchy, availableColumns, fetchColumnsFromQuery }) => {
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
  const isResizingRef = useRef(isResizing);
  const textareaRef = useRef(null);

  useEffect(() => {
    setSelectedColumns(currentHierarchy || []);
    setOrderedColumns(currentHierarchy || []);
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

  const handleMouseMove = (e) => {
    if (!isResizingRef.current) return;
    const newWidth = Math.min(Math.max(e.clientX, 200), 600);
    setPanelWidth(newWidth);
  };
  
  const handleMouseUp = () => {
    if (isResizingRef.current) {
      setIsResizing(false);
    }
  };

  useEffect(() => {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);


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

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
  };

  const parseQuery = (query) => {
    const normalizedQuery = query.replace(/\s+/g, ' ').trim();
    const queryRegex = /^SELECT\s+(.+?)\s+FROM\s+(.+?)(\s+(?:WHERE|GROUP BY|ORDER BY|;|$))/i;
    const match = normalizedQuery.match(queryRegex);

    if (match) {
      const selectPart = match[1].trim();
      const fromPart = match[2].trim();
      return { selectClause: selectPart, fromClause: fromPart };
    }

    const simpleRegex = /^SELECT\s+(.+?)\s+FROM\s+(.+)$/i;
    const simpleMatch = normalizedQuery.match(simpleRegex);
    if (simpleMatch) {
      const selectPart = simpleMatch[1].trim();
      const fromPart = simpleMatch[2].trim();
      return { selectClause: selectPart, fromClause: fromPart };
    }

    return { selectClause: '*', fromClause: 'lineage_table' };
  };

  const handleQuerySubmit = async () => {
    const { selectClause, fromClause } = parseQuery(queryText);
    const columns = await fetchColumnsFromQuery(queryText);
    if (Array.isArray(columns) && columns.length > 0) {
      setSelectClause(selectClause);
      setFromClause(fromClause);
      setFilterSelections({});
      setFilteredData(null);
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
        const nullCondition = nullValues.length > 0 ? `${escapeColumn(column)} IS NULL` : '';
        const nonNullCondition = nonNullValues.length > 0
          ? `${escapeColumn(column)} IN (${nonNullValues.map((v) => `'${v.replace(/'/g, "''")}'`).join(', ')})`
          : '';
        return [nullCondition, nonNullCondition].filter(Boolean).join(' OR ');
      })
      .filter(Boolean);

    const hasWhereClause = queryText.toLowerCase().includes('where');
    let query;
    if (hasWhereClause) {
      query = `${queryText} ${conditions.length ? ' AND ' + conditions.join(' AND ') : ''}`;
    } else {
      query = `SELECT ${selectClause} FROM ${fromClause}${
        conditions.length ? ' WHERE ' + conditions.join(' AND ') : ''
      }`;
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
              paddingBottom: '60px',
              boxSizing: 'border-box',
            }}
          >
            <h2 style={{ fontSize: '18px', marginBottom: '15px', color: '#333', fontWeight: 'bold' }}>
              Configuration Panel
            </h2>

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

          <div
            style={{
              position: 'absolute',
              bottom: '15px',
              left: 0,
              width: '100%',
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <button
              onClick={handleApply}
              style={{
                padding: '10px 20px',
                background: '#ffffffff',
                color: '#333',
                border: '1px solid #ccc',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold',
                width: '90%',
                maxWidth: '250px',
              }}
            >
              Apply
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