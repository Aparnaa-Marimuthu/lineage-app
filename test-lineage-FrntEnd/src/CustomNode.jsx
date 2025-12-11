import { Handle } from '@xyflow/react';
import { FiPlus, FiMinus } from 'react-icons/fi';

const CustomNode = ({ data, onClick, hierarchyKeys }) => {

  const isAttributeLevel = data.level === hierarchyKeys.length - 1;
  const isRoot = data.level === -1;

  return (
    <div
      style={{
        paddingTop: isAttributeLevel ? 0 : (data.level === -1 ? 10 : 5),
        paddingBottom: isAttributeLevel ? 0 : (data.level === -1 ? 20 : 5),
        paddingLeft: isAttributeLevel ? 0 : (data.level === -1 ? 20 : 10),
        paddingRight: isAttributeLevel ? 0 : (data.level === -1 ? 10 : 30),
        border: '1.5px solid #adadadff',
        borderRadius: 8,
        borderColor: '#adadadff',
        backgroundColor: '#ffffff',
        minWidth: 180,
        fontWeight: 'bold',
        cursor: data.level >= 0 ? 'pointer' : 'default',
        textAlign: 'top',
        overflow: 'visible',
        position: 'relative',
        zIndex: -10,
      }}
      onClick={(e) => {
        if (e.defaultPrevented) return;
        if (data.level < hierarchyKeys.length - 1) onClick(data);
      }}
    >
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 10,
        backgroundColor: '#2196F3',
        borderTopLeftRadius: 8,
        borderTopRightRadius: 8
      }} />

      {!isAttributeLevel && (
        <>
          <div style={{ paddingTop: 6, fontSize: 12, color: '#868484ff' }}>
            {data.level === -1 ? 'Root' : hierarchyKeys[data.level]}
          </div>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'left', 
            gap: 6, 
            fontSize: 14, 
            paddingTop: 10 
          }}>
           <span style={{ color: 'black', fontWeight: 'bold' }}>
             {data.label}
           </span>
          </div>

          {data.level > -1 && (
            <div style={{ textAlign: 'left', fontSize: '12px', fontWeight: 'bold', color: '#868484ff', paddingBottom: 5 }}>
              <hr style={{ border: '0.5px solid #adadadff', margin: '6px 0' }} />
              <p>Count {data.childCount ?? ''}</p>
            </div>
          )}

          <Handle type="target" position="left" />

          {data.level >= 0 && data.level < hierarchyKeys.length - 1 && (
            <div
              style={{
                position: 'absolute',
                right: -12,
                top: '50%',
                transform: 'translateY(-50%)',
                display: 'flex',
                gap: 8,
              }}
            >
              <div
                style={{
                  backgroundColor: '#ffffffff',
                  border: '2px solid black',
                  borderRadius: '50%',
                  width: 28,
                  height: 28,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  zIndex: 10,
                  boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                }}
                onClick={() => {
                  onClick(data);
                }}
                title={data.isExpanded ? 'Collapse' : 'Expand'}
              >
                {data.isExpanded ? (
                  <FiMinus color="black" size={18}/>
                ) : (
                  <FiPlus color="black" size={18}/>
                )}
              </div>
            </div>
          )}

          <Handle type="source" position="right"  style={{ visibility: "hidden" }} />
        </>
      )}

      {isAttributeLevel && (
        <div style={{ borderRadius: 8, overflowY: 'auto', maxHeight: 200, position: 'relative' }}>
          <div style={{ background: '#2196F3', color: 'white', padding: '6px 8px', textAlign: 'left', fontSize: 14, position: 'sticky', top: 0, zIndex: 10, borderTopLeftRadius: 8, borderTopRightRadius: 8 }}>
          </div>
          <div style={{ padding: 8, textAlign: 'left' }}>
            {data.attributes?.map((attr, idx) => (
              <div key={idx} style={{ fontSize: 13, color: '#333', marginBottom: 4, gap: '6px', maxHeight: '200px' }}>
                <span style={{ color: 'black', fontWeight: 'bold', marginRight: 6 }}>
                {attr}
                </span>
              </div>
            ))}
          </div>
          <Handle type="target" position="left" />
        </div>
      )}
    </div>
  );
};

export default CustomNode;