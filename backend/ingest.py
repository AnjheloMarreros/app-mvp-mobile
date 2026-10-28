import os
import glob
import json
from dotenv import load_dotenv
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_chroma import Chroma
from langchain_google_genai import GoogleGenerativeAIEmbeddings

load_dotenv()

# Rutas
DATA_DIR = "data"
CASOS_DIR = os.path.join(DATA_DIR, "casos")
LEYES_DIR = os.path.join(DATA_DIR, "leyes")
CHROMA_PATH = "chroma_db"

def ingest_data():
    if not os.environ.get("GOOGLE_API_KEY"):
        print("Error: No se encontró GOOGLE_API_KEY en el entorno.")
        return

    print("Iniciando embeddings de Google...")
    embeddings = GoogleGenerativeAIEmbeddings(model="models/gemini-embedding-2")

    # 1. Procesar MD de casos
    print("Cargando documentos de casos (.md)...")
    casos_docs = []
    for md_file in glob.glob(os.path.join(CASOS_DIR, "*.md")):
        with open(md_file, 'r', encoding='utf-8') as f:
            content = f.read()
            # Identificar el ID del caso desde el nombre del archivo
            caso_id = os.path.basename(md_file).replace('.md', '')
            casos_docs.append({
                "page_content": content,
                "metadata": {"source": caso_id, "type": "caso_soporte"}
            })

    # 2. Procesar Leyes (PDF)
    print("Cargando leyes (.pdf)...")
    pdf_files = glob.glob(os.path.join(LEYES_DIR, "*.pdf"))
    leyes_docs_raw = []
    for pdf_file in pdf_files:
        loader = PyPDFLoader(pdf_file)
        leyes_docs_raw.extend(loader.load())

    # Fragmentar (chunking) las leyes
    print("Fragmentando leyes...")
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200,
        separators=["\n\n", "\n", ".", " ", ""]
    )
    leyes_chunks = text_splitter.split_documents(leyes_docs_raw)
    
    # Marcar metadata de leyes
    for chunk in leyes_chunks:
        chunk.metadata["type"] = "ley_peruana"

    print("Indexando en ChromaDB (con retraso para evitar límite de cuota gratuita)...")
    
    from langchain_core.documents import Document
    import time
    
    casos_langchain_docs = [Document(page_content=d["page_content"], metadata=d["metadata"]) for d in casos_docs]
    all_docs = casos_langchain_docs + leyes_chunks

    # Crear base de datos local
    vector_db = Chroma(persist_directory=CHROMA_PATH, embedding_function=embeddings)
    
    # Batch processing with rate limiting and exponential backoff
    batch_size = 20
    for i in range(0, len(all_docs), batch_size):
        batch = all_docs[i:i+batch_size]
        print(f"Indexando lote {i//batch_size + 1} de {len(all_docs)//batch_size + 1}...")
        
        success = False
        while not success:
            try:
                vector_db.add_documents(batch)
                success = True
            except Exception as e:
                error_msg = str(e)
                if "429" in error_msg or "RESOURCE_EXHAUSTED" in error_msg:
                    print("Cuota excedida. Esperando 60 segundos antes de reintentar...")
                    time.sleep(60)
                else:
                    raise e
                    
        # Pequeña pausa entre lotes exitosos
        time.sleep(5)

    print(f"¡Ingesta completada! Se indexaron {len(casos_docs)} soportes de casos y {len(leyes_chunks)} fragmentos de leyes.")
    print(f"Base de datos guardada en: {CHROMA_PATH}")

if __name__ == "__main__":
    ingest_data()
