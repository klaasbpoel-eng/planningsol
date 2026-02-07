
import json

def get_category(name):
    lower_name = name.lower()
    if 'stikstof' in lower_name: return 'Stikstof'
    if 'zuurstof' in lower_name: return 'Zuurstof'
    if 'argon' in lower_name: return 'Argon'
    if 'acetyleen' in lower_name: return 'Acetyleen'
    if 'kooldioxide' in lower_name or 'co2' in lower_name or 'koolzuur' in lower_name: return 'CO2'
    if 'weldmix' in lower_name: return 'Weldmix'
    if 'formeergas' in lower_name: return 'Formeergas'
    if 'helium' in lower_name: return 'Helium'
    if 'propaan' in lower_name: return 'Propaan'
    if 'waterstof' in lower_name: return 'Waterstof' # New guess based on data
    if 'lucht' in lower_name: return 'Gas' # Match existing behavior
    if 'alisol' in lower_name: return 'Gas' # Or specific
    return 'Gas'

articles = []
seen_ids = set()

with open('new_articles_raw.txt', 'r', encoding='utf-8') as f:
    lines = f.readlines()
    
    # Skip header
    if 'ArtikelCode' in lines[0]:
        lines = lines[1:]
        
    for line in lines:
        parts = line.strip().split('\t')
        if len(parts) < 2:
            # Try splitting by space if tab fails, but be careful of spaces in name
            # The id is always first
            parts = line.strip().split(maxsplit=1)
            
        if len(parts) >= 2:
            id_val = parts[0].strip()
            if id_val in seen_ids: continue
            
            name_val = parts[1].strip()
            category = get_category(name_val)
            
            articles.append({
                'id': id_val,
                'name': name_val,
                'category': category
            })
            seen_ids.add(id_val)

# Generate TS content
ts_content = """export interface Article {
  id: string;
  name: string;
  category: string;
}

export const ARTICLES: Article[] = [
"""

for art in articles:
    ts_content += f'  {{\n    "id": "{art["id"]}",\n    "name": "{art["name"]}",\n    "category": "{art["category"]}"\n  }},\n'

ts_content += "];\n"

with open('src/data/articles.ts', 'w', encoding='utf-8') as f:
    f.write(ts_content)

print(f"Processed {len(articles)} articles.")
