import express from 'express';
import * as soap from 'soap';
import fs from 'fs';
import path from 'path';
import getDb, { logQuery, resetSqlCounter, getSqlCount } from '../../shared/db';
import type { Book, Author, Review } from '../../shared/types';

const PORT = 3003;
const db = getDb();

// =================================================================
// Définition du WSDL (écrit à la main pour la démo)
// =================================================================
const wsdlContent = `<?xml version="1.0" encoding="UTF-8"?>
<definitions name="BookCatalogService"
  targetNamespace="http://localhost:${PORT}/bookcatalog"
  xmlns="http://schemas.xmlsoap.org/wsdl/"
  xmlns:soap="http://schemas.xmlsoap.org/wsdl/soap/"
  xmlns:tns="http://localhost:${PORT}/bookcatalog"
  xmlns:xsd="http://www.w3.org/2001/XMLSchema">

  <!-- Types XSD -->
  <types>
    <xsd:schema targetNamespace="http://localhost:${PORT}/bookcatalog">

      <xsd:complexType name="Author">
        <xsd:sequence>
          <xsd:element name="id" type="xsd:int"/>
          <xsd:element name="name" type="xsd:string"/>
          <xsd:element name="bio" type="xsd:string"/>
          <xsd:element name="nationality" type="xsd:string"/>
        </xsd:sequence>
      </xsd:complexType>

      <xsd:complexType name="Review">
        <xsd:sequence>
          <xsd:element name="id" type="xsd:int"/>
          <xsd:element name="book_id" type="xsd:int"/>
          <xsd:element name="reviewer" type="xsd:string"/>
          <xsd:element name="text" type="xsd:string"/>
          <xsd:element name="rating" type="xsd:int"/>
        </xsd:sequence>
      </xsd:complexType>

      <xsd:complexType name="Book">
        <xsd:sequence>
          <xsd:element name="id" type="xsd:int"/>
          <xsd:element name="title" type="xsd:string"/>
          <xsd:element name="year" type="xsd:int"/>
          <xsd:element name="genre" type="xsd:string"/>
          <xsd:element name="author_id" type="xsd:int"/>
          <xsd:element name="author" type="tns:Author" minOccurs="0"/>
          <xsd:element name="reviews" type="tns:Review" minOccurs="0" maxOccurs="unbounded"/>
        </xsd:sequence>
      </xsd:complexType>

      <xsd:complexType name="BookList">
        <xsd:sequence>
          <xsd:element name="book" type="tns:Book" minOccurs="0" maxOccurs="unbounded"/>
        </xsd:sequence>
      </xsd:complexType>

      <xsd:complexType name="AuthorWithBooks">
        <xsd:sequence>
          <xsd:element name="id" type="xsd:int"/>
          <xsd:element name="name" type="xsd:string"/>
          <xsd:element name="bio" type="xsd:string"/>
          <xsd:element name="nationality" type="xsd:string"/>
          <xsd:element name="books" type="tns:Book" minOccurs="0" maxOccurs="unbounded"/>
        </xsd:sequence>
      </xsd:complexType>

      <!-- Messages d'entrée -->
      <xsd:element name="GetBookRequest">
        <xsd:complexType>
          <xsd:sequence>
            <xsd:element name="id" type="xsd:int"/>
          </xsd:sequence>
        </xsd:complexType>
      </xsd:element>

      <xsd:element name="GetBooksRequest">
        <xsd:complexType>
          <xsd:sequence>
            <xsd:element name="limit" type="xsd:int"/>
            <xsd:element name="offset" type="xsd:int"/>
          </xsd:sequence>
        </xsd:complexType>
      </xsd:element>

      <xsd:element name="GetAuthorRequest">
        <xsd:complexType>
          <xsd:sequence>
            <xsd:element name="id" type="xsd:int"/>
          </xsd:sequence>
        </xsd:complexType>
      </xsd:element>

      <xsd:element name="AddReviewRequest">
        <xsd:complexType>
          <xsd:sequence>
            <xsd:element name="bookId" type="xsd:int"/>
            <xsd:element name="reviewer" type="xsd:string"/>
            <xsd:element name="text" type="xsd:string"/>
            <xsd:element name="rating" type="xsd:int"/>
          </xsd:sequence>
        </xsd:complexType>
      </xsd:element>

      <!-- Messages de sortie -->
      <xsd:element name="GetBookResponse" type="tns:Book"/>
      <xsd:element name="GetBooksResponse" type="tns:BookList"/>
      <xsd:element name="GetAuthorResponse" type="tns:AuthorWithBooks"/>
      <xsd:element name="AddReviewResponse" type="tns:Review"/>

    </xsd:schema>
  </types>

  <!-- Messages -->
  <message name="GetBookInput"><part name="parameters" element="tns:GetBookRequest"/></message>
  <message name="GetBookOutput"><part name="parameters" element="tns:GetBookResponse"/></message>
  <message name="GetBooksInput"><part name="parameters" element="tns:GetBooksRequest"/></message>
  <message name="GetBooksOutput"><part name="parameters" element="tns:GetBooksResponse"/></message>
  <message name="GetAuthorInput"><part name="parameters" element="tns:GetAuthorRequest"/></message>
  <message name="GetAuthorOutput"><part name="parameters" element="tns:GetAuthorResponse"/></message>
  <message name="AddReviewInput"><part name="parameters" element="tns:AddReviewRequest"/></message>
  <message name="AddReviewOutput"><part name="parameters" element="tns:AddReviewResponse"/></message>

  <!-- Port Type -->
  <portType name="BookCatalogPortType">
    <operation name="GetBook">
      <input message="tns:GetBookInput"/>
      <output message="tns:GetBookOutput"/>
    </operation>
    <operation name="GetBooks">
      <input message="tns:GetBooksInput"/>
      <output message="tns:GetBooksOutput"/>
    </operation>
    <operation name="GetAuthor">
      <input message="tns:GetAuthorInput"/>
      <output message="tns:GetAuthorOutput"/>
    </operation>
    <operation name="AddReview">
      <input message="tns:AddReviewInput"/>
      <output message="tns:AddReviewOutput"/>
    </operation>
  </portType>

  <!-- Binding SOAP -->
  <binding name="BookCatalogBinding" type="tns:BookCatalogPortType">
    <soap:binding style="document" transport="http://schemas.xmlsoap.org/soap/http"/>
    <operation name="GetBook">
      <soap:operation soapAction="GetBook"/>
      <input><soap:body use="literal"/></input>
      <output><soap:body use="literal"/></output>
    </operation>
    <operation name="GetBooks">
      <soap:operation soapAction="GetBooks"/>
      <input><soap:body use="literal"/></input>
      <output><soap:body use="literal"/></output>
    </operation>
    <operation name="GetAuthor">
      <soap:operation soapAction="GetAuthor"/>
      <input><soap:body use="literal"/></input>
      <output><soap:body use="literal"/></output>
    </operation>
    <operation name="AddReview">
      <soap:operation soapAction="AddReview"/>
      <input><soap:body use="literal"/></input>
      <output><soap:body use="literal"/></output>
    </operation>
  </binding>

  <!-- Service -->
  <service name="BookCatalogService">
    <port name="BookCatalogPort" binding="tns:BookCatalogBinding">
      <soap:address location="http://localhost:${PORT}/bookcatalog"/>
    </port>
  </service>

</definitions>`;

// Écrire le WSDL dans un fichier temporaire (requis par la lib soap)
const wsdlPath = path.join(__dirname, '..', 'service.wsdl');
fs.writeFileSync(wsdlPath, wsdlContent);

// =================================================================
// Implémentation du service SOAP
// =================================================================
const service = {
  BookCatalogService: {
    BookCatalogPort: {
      /** Récupérer un livre avec son auteur et ses reviews */
      GetBook: (args: { id: number }) => {
        const id = parseInt(String(args.id));

        logQuery(`SELECT * FROM books WHERE id = ${id}`);
        const book = db.prepare('SELECT * FROM books WHERE id = ?').get(id) as Book | undefined;
        if (!book) return { error: 'Livre non trouvé' };

        logQuery(`SELECT * FROM authors WHERE id = ${book.author_id}`);
        const author = db.prepare('SELECT * FROM authors WHERE id = ?').get(book.author_id) as Author;

        logQuery(`SELECT * FROM reviews WHERE book_id = ${id}`);
        const reviews = db.prepare('SELECT * FROM reviews WHERE book_id = ?').all(id) as Review[];

        return {
          id: book.id,
          title: book.title,
          year: book.year,
          genre: book.genre,
          author_id: book.author_id,
          author,
          reviews: reviews,
        };
      },

      /** Liste paginée de livres avec leurs auteurs */
      GetBooks: (args: { limit: number; offset: number }) => {
        const limit = parseInt(String(args.limit)) || 10;
        const offset = parseInt(String(args.offset)) || 0;

        logQuery(`SELECT * FROM books LIMIT ${limit} OFFSET ${offset}`);
        const books = db.prepare('SELECT * FROM books LIMIT ? OFFSET ?').all(limit, offset) as Book[];

        // Charger les auteurs pour chaque livre
        const authorIds = [...new Set(books.map((b) => b.author_id))];
        const authorsMap = new Map<number, Author>();
        if (authorIds.length > 0) {
          const placeholders = authorIds.map(() => '?').join(',');
          logQuery(`SELECT * FROM authors WHERE id IN (${authorIds.join(',')})`);
          const authors = db.prepare(`SELECT * FROM authors WHERE id IN (${placeholders})`).all(...authorIds) as Author[];
          authors.forEach((a) => authorsMap.set(a.id, a));
        }

        return {
          book: books.map((b) => ({
            id: b.id,
            title: b.title,
            year: b.year,
            genre: b.genre,
            author_id: b.author_id,
            author: authorsMap.get(b.author_id),
          })),
        };
      },

      /** Récupérer un auteur avec ses livres */
      GetAuthor: (args: { id: number }) => {
        const id = parseInt(String(args.id));

        logQuery(`SELECT * FROM authors WHERE id = ${id}`);
        const author = db.prepare('SELECT * FROM authors WHERE id = ?').get(id) as Author | undefined;
        if (!author) return { error: 'Auteur non trouvé' };

        logQuery(`SELECT * FROM books WHERE author_id = ${id}`);
        const books = db.prepare('SELECT * FROM books WHERE author_id = ?').all(id) as Book[];

        return {
          ...author,
          books,
        };
      },

      /** Ajouter une review */
      AddReview: (args: { bookId: number; reviewer: string; text: string; rating: number }) => {
        const bookId = parseInt(String(args.bookId));

        logQuery(`INSERT INTO reviews (book_id, reviewer, text, rating)`);
        const result = db.prepare(
          'INSERT INTO reviews (book_id, reviewer, text, rating) VALUES (?, ?, ?, ?)'
        ).run(bookId, args.reviewer, args.text, parseInt(String(args.rating)));

        return {
          id: result.lastInsertRowid as number,
          book_id: bookId,
          reviewer: args.reviewer,
          text: args.text,
          rating: parseInt(String(args.rating)),
        };
      },
    },
  },
};

// =================================================================
// Serveur Express + SOAP
// =================================================================
const app = express();

// Endpoint admin pour le benchmark
app.post('/admin/reset-sql-counter', (_req, res) => {
  resetSqlCounter();
  res.json({ ok: true });
});
app.get('/admin/sql-count', (_req, res) => {
  res.json({ count: getSqlCount() });
});

// Servir le WSDL sur GET /wsdl
app.get('/wsdl', (_req, res) => {
  res.setHeader('Content-Type', 'text/xml');
  res.send(wsdlContent);
});

app.listen(PORT, () => {
  // Monter le service SOAP
  const wsdlXml = fs.readFileSync(wsdlPath, 'utf-8');
  soap.listen(app, '/bookcatalog', service, wsdlXml);

  console.log(`🟠 SOAP server démarré sur http://localhost:${PORT}`);
  console.log(`   WSDL disponible sur http://localhost:${PORT}/wsdl`);
  console.log(`   Endpoint SOAP : http://localhost:${PORT}/bookcatalog`);
});

export default app;
