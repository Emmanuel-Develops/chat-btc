import type { PageConfig } from "next";
import ERROR_MESSAGES from "@/config/error-config";
import { processInput } from "@/utils/openaiChat";
import { createReadableStream } from "@/utils/stream";
import { isValidPaymentToken } from "@/utils/token";

export const config: PageConfig = {
  runtime: "edge",
};

const getSearchUrl = (url: string) => {
  const reqUrl = url.split("/")
  reqUrl.pop()
  return reqUrl.join("/") + "/search"
}

export const internalFetch = async (url: string, query: string, author?: string) : Promise<any[] | null> => {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      inputs: {
        question: query,
        author: author,
      },
    }),
  });
  
  if (!response.ok) {
    return null
  }

  return await response.json();
};

export default async function handler(req: Request) {
  if (req.method === "POST") {
    const token = req.headers.get("Authorization")
    console.log({token})
    if (!token) {
      return new Response(JSON.stringify({ message: "No Payment Token" }), { status: 402 })
    }
    const isValidToken = isValidPaymentToken(token)
    if (!isValidToken) {
      return new Response(JSON.stringify({ message: "Invalid Token" }), { status: 402 })
    }
    const fetchUrl = getSearchUrl(req.url)

    const { inputs } = await req.json();
    const { query, author }: {query: string, author: string} = inputs;

    const esResults = await internalFetch(fetchUrl, query, author)
    
    if (!esResults || !esResults.length) {
      const error = createReadableStream(ERROR_MESSAGES.NO_ANSWER)
      return new Response(error)
    }

    try {
      const result = await processInput(esResults, query);
      return new Response(result)
    } catch (error: any) {
      
      const errMessage = error?.message ? error.message : ERROR_MESSAGES.UNKNOWN
      return new Response(JSON.stringify({error: errMessage}), { status: 400 })
    }

  } else {
    return new Response(JSON.stringify({ message: "Method not allowed" }), { status: 405 })
  }
}

const verifyHeader = (reqHeader: Request["headers"]) => {
  const l402Header = reqHeader.get("Authorization")
  if (!l402Header) {
    return new Response(JSON.stringify({ message: "No authorization header is present" }), { status: 403 })
  }
}
