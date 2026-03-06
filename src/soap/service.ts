import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { RequestHandler } from 'express';
import { q, type Author, type Book, type Review } from '../db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const wsdl = readFileSync(path.join(__dirname, 'BookCatalog.wsdl'), 'utf-8');

// Extrait la valeur d'un paramètre dans le XML de la requête ex: <tns:BookId>1</tns:BookId> → "1"
function extractParam(xml: string, name: string): string | undefined {
  return xml.match(new RegExp(`<(?:tns:)?${name}[^>]*>\\s*([^<]+)\\s*</`))?.[1]?.trim();
}

// Enveloppe n'importe quel body dans la structure SOAP standard
function soapResponse(body: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
${body}
  </soap:Body>
</soap:Envelope>`;
}

// Échappe les caractères spéciaux XML pour éviter de casser la réponse
function escXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Sérialise un livre en XML — auteur et reviews inclus si fournis
// Note : SOAP retourne toujours tout, il n'y a pas de sélection de champs possible
function xmlBook(b: Book, author?: Author, reviews?: Review[]): string {
  const authorXml = author ? `
      <Author>
        <Id>${author.id}</Id>
        <Name>${escXml(author.name)}</Name>
        <Bio>${escXml(author.bio ?? '')}</Bio>
        <Nationality>${escXml(author.nationality ?? '')}</Nationality>
      </Author>` : '';

  const reviewsXml = reviews ? `
      <Reviews>${reviews.map(r => `
        <Review>
          <Id>${r.id}</Id>
          <Reviewer>${escXml(r.reviewer)}</Reviewer>
          <Rating>${r.rating}</Rating>
          <Comment>${escXml(r.comment ?? '')}</Comment>
        </Review>`).join('')}
      </Reviews>` : '';

  return `<Book>
        <Id>${b.id}</Id>
        <Title>${escXml(b.title)}</Title>
        <Year>${b.year}</Year>
        <Genre>${escXml(b.genre)}</Genre>
        <AuthorId>${b.author_id}</AuthorId>${authorXml}${reviewsXml}
      </Book>`;
}

// GetBook : 3 SQL systématiques (livre + auteur + reviews), même si le client n'en a pas besoin
function handleGetBook(xml: string): string {
  const book = q.get<Book>('SELECT * FROM books WHERE id = ?', [extractParam(xml, 'BookId')]);
  if (!book) return soapResponse(`    <soap:Fault><faultcode>Client</faultcode><faultstring>Book not found</faultstring></soap:Fault>`);

  const author  = q.get<Author>('SELECT * FROM authors WHERE id = ?', [book.author_id]);
  const reviews = q.all<Review>('SELECT * FROM reviews WHERE book_id = ?', [book.id]);
  return soapResponse(`    <GetBookResponse>${xmlBook(book, author, reviews)}</GetBookResponse>`);
}

// GetBooks : batch des auteurs en 1 SQL via IN(...) pour éviter le N+1
function handleGetBooks(xml: string): string {
  const limit  = parseInt(extractParam(xml, 'Limit')  ?? '10');
  const offset = parseInt(extractParam(xml, 'Offset') ?? '0');

  const books     = q.all<Book>('SELECT * FROM books LIMIT ? OFFSET ?', [limit, offset]);
  const authorIds = [...new Set(books.map(b => b.author_id))];
  const authors   = authorIds.length > 0
    ? q.all<Author>(`SELECT * FROM authors WHERE id IN (${authorIds.map(() => '?').join(',')})`, authorIds)
    : [];
  const authorMap = new Map(authors.map(a => [a.id, a]));

  return soapResponse(`    <GetBooksResponse><Books>
      ${books.map(b => xmlBook(b, authorMap.get(b.author_id))).join('\n      ')}
    </Books></GetBooksResponse>`);
}

function handleGetAuthor(xml: string): string {
  const author = q.get<Author>('SELECT * FROM authors WHERE id = ?', [extractParam(xml, 'AuthorId')]);
  if (!author) return soapResponse(`    <soap:Fault><faultcode>Client</faultcode><faultstring>Author not found</faultstring></soap:Fault>`);

  return soapResponse(`    <GetAuthorResponse>
      <Author>
        <Id>${author.id}</Id>
        <Name>${escXml(author.name)}</Name>
        <Bio>${escXml(author.bio ?? '')}</Bio>
        <Nationality>${escXml(author.nationality ?? '')}</Nationality>
      </Author>
    </GetAuthorResponse>`);
}

function handleGetBookReviews(xml: string): string {
  const reviews = q.all<Review>('SELECT * FROM reviews WHERE book_id = ?', [extractParam(xml, 'BookId')]);
  return soapResponse(`    <GetBookReviewsResponse><Reviews>${reviews.map(r => `
      <Review>
        <Id>${r.id}</Id>
        <Reviewer>${escXml(r.reviewer)}</Reviewer>
        <Rating>${r.rating}</Rating>
        <Comment>${escXml(r.comment ?? '')}</Comment>
      </Review>`).join('')}
    </Reviews></GetBookReviewsResponse>`);
}

// Dispatche la requête SOAP vers le bon handler en lisant le nom de l'opération dans le XML
export const soapHandler: RequestHandler = (req, res) => {
  const xml = req.body as string;
  const operation = xml.match(/<(?:tns:)?(\w+)\s*(?:xmlns[^>]*)?\s*>/)?.[1];

  const handlers: Record<string, (xml: string) => string> = {
    GetBook:        handleGetBook,
    GetBooks:       handleGetBooks,
    GetAuthor:      handleGetAuthor,
    GetBookReviews: handleGetBookReviews,
  };

  const responseXml = handlers[operation ?? '']?.(xml)
    ?? soapResponse(`    <soap:Fault><faultcode>Client</faultcode><faultstring>Unknown operation: ${operation}</faultstring></soap:Fault>`);

  res.set('Content-Type', 'text/xml; charset=utf-8').send(responseXml);
};

// Sert le WSDL — point d'entrée pour les outils qui veulent découvrir le service
export const wsdlHandler: RequestHandler = (_req, res) => {
  res.set('Content-Type', 'text/xml; charset=utf-8').send(wsdl);
};
