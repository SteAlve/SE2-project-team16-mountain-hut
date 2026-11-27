/**
 * A menu as hikers and the staff read it (Figma "Menu text", MH-10): its lines, with bold, italic,
 * items and sub-items. A line that is all bold (the title of the menu) is a little larger.
 * `menu` is the text of the server (lib/menuText.js). React escapes every text: nothing in a menu can
 * become markup.
 */
import { parseMenu } from '../../lib/menuText.js';
import styles from './MenuText.module.css';

function Runs({ runs }) {
  return runs.map(({ text, bold, italic }, index) => {
    let node = text;
    if (italic) node = <em>{node}</em>;
    if (bold) node = <strong>{node}</strong>;
    return <span key={index}>{node}</span>;
  });
}

const isTitle = (runs) => runs.length > 0 && runs.every((run) => run.bold || run.text.trim() === '');

export function MenuText({ menu, className = '' }) {
  return (
    <div className={`${styles.menu} ${className}`}>
      {parseMenu(menu).map((block, index) => {
        if (block.kind === 'blank') return <div key={index} className={styles.blank} aria-hidden="true" />;
        if (block.kind === 'line') {
          return (
            <p key={index} className={`${styles.line} ${isTitle(block.runs) ? styles.title : ''}`}>
              <Runs runs={block.runs} />
            </p>
          );
        }
        return (
          <ul key={index} className={styles.items}>
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex}>
                <Runs runs={item.runs} />
                {item.subItems.length > 0 && (
                  <ul className={styles.subItems}>
                    {item.subItems.map((sub, subIndex) => (
                      <li key={subIndex}>
                        <Runs runs={sub} />
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        );
      })}
    </div>
  );
}
