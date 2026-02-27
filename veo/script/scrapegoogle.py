import pandas as pd
import requests

api_key = "685bbb365751c32615c1145a"
url = "https://api.scrapingdog.com/google"



# Function to perform a Google search
def google_search(query):
    params = {
    "api_key": api_key,
    "query": query,
    "location" : "vietnam",
    "country": "vn",
    "results" :1
    }

    response = requests.get(url, params=params, verify=False)

    if 'organic_results' in response.json():
        organic_results = response.json()['organic_results']
        return organic_results
    else:
        print("No organic_results found in the response.")
        return None
        

# Function to extract the first LinkedIn link from search results
def extract_data_from_search_result(string):
    # Extract the required fields from the search result
    for result in string:
        if 'link' in result and 'linkedin.com/company' in result['link']:
            linkedin_url = result['link']
            snippet = result.get('snippet', '')
            
            # Extract company size
            company_size = None
            if 'Quy mô công ty:' in snippet:
                company_size_start = snippet.find('Quy mô công ty:') + len('Quy mô công ty:')
                company_size_end = snippet.find('nhân viên', company_size_start)
                company_size = snippet[company_size_start:company_size_end].strip()
            
            # Extract domain
            domain = None
            if 'Ngành:' in snippet:
                domain_start = snippet.find('Ngành:') + len('Ngành:')
                domain_end = min((snippet.find(c, domain_start) for c in ['.', ';'] if snippet.find(c, domain_start) != -1), default=-1)
                domain = snippet[domain_start:domain_end].strip()

            return linkedin_url, company_size, domain
    return None, None, None
   

company_dict = {}
# Main function to read the XLSX file and search for each company
def main():
    # Load the Excel file
    df = pd.read_excel('./vy.xlsx')

    df['Sizing'] = None
    
    # Iterate through each row in the DataFrame
    for index, row in df.iterrows():
        company_name = row['Company Name']
        if company_name in company_dict:
            linkedin_url, company_size, domain = company_dict[company_name]
        else:
            query = f'{company_name} "Ngành" "Quy mô công ty" site:linkedin.com/company'
            try:
                search_results_html = google_search(query)
                linkedin_url, company_size, domain = extract_data_from_search_result(search_results_html)
                
                # Store the results in the dictionary
                company_dict[company_name] = (linkedin_url, company_size, domain)
            except Exception as e:
                print(f"Error searching for {company_name}: {e}")
                linkedin_url, company_size, domain = None, None, None
        
        # Update the DataFrame with the extracted data
        df.at[index, 'Domain'] = domain
        df.at[index, 'Sizing'] = company_size

            # Print the extracted data
        print(f"Return {company_name}: LinkedIn URL: {linkedin_url or 'Not found'}, Company Size: {company_size or 'Not found'}, domain: {domain or 'Not found'}")
    
    df.to_excel('./vfi.xlsx', index=False)
    print("Data has been written to 603.xlsx")
    
if __name__ == "__main__":
    main()