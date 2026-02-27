import requests
import bs4 as bs
import pandas as pd  # Importing pandas for data handling
import re

username = 'hqtuan1@cmcglobal.vn'
password = 'CMCG2025@'

login_url = 'https://amchamvietnam.chambermaster.com/login/authenticate'
# Base URL for the directory
base_url = "https://amchamvietnam.chambermaster.com/mic/members/search?q=&ql=&gi=51&gi=35&gi=38&gi=37&d=0&st=&memid=4967&repid=18889&micversion=4"

company_dict = {}

def get_linkedin_url(session,soup, company_name, company_url):
    """Get the LinkedIn URL from the company page."""
    # Check if already in the dictionary
    if company_name in company_dict:
        return company_dict[company_name]  

    # Navigate to the company URL
    response = session.get(company_url, verify=False)
    if response.ok:
        soup = bs.BeautifulSoup(response.content, 'html.parser')
        linkedin_element = soup.find('li', class_='mn-socialnetwork mn-linkedin')
        
        if linkedin_element and linkedin_element.find('a'):
            linkedin = linkedin_element.find('a')['href']
            print(f"Found LinkedIn URL for {company_name}: {linkedin}")
            return linkedin
    
    return 'N/A'
   

def get_next_page(soup):
    """Extract pagination links from the pagination section."""
    next_link = soup.find('li', class_='next nomargin')
    if next_link and next_link.find('a'):
        return next_link.find('a')['href']
    return None

def safe_extract_text(element, default='N/A'):
    """Helper function to safely extract text from an HTML element."""
    return element.text.strip() if element else default

def extract_title(title_text):
    """Extracts the title from a string that may be inside parentheses."""
    match = re.search(r'\((.*?)\)', title_text)
    return match.group(1) if match else 'N/A'


def scrape(session ,response):
    soup = bs.BeautifulSoup(response.content, 'html.parser')
    listings = soup.find_all('div', class_='span12 mn-searchlisting-detail')
    results = []
    for listing in listings:
        try:
            name = safe_extract_text(listing.find('div', class_='mn-searchlisting-title').find('a'))

            title_text = safe_extract_text(listing.find_all('div', class_='mn-searchlisting-title')[1].find('em'))
            title = extract_title(title_text)  # Extract title from text


            company_name_tag = listing.find('div', class_='mn-highlight').find('a')
            company_name = safe_extract_text(company_name_tag)
            
            # Get the URL of the company
            company_url = company_name_tag['href'] if company_name_tag else 'N/A'
            
            contact_info_tag = listing.find('span', class_='mn-searchlisting-phone')
            contact_info = safe_extract_text(contact_info_tag).replace('Phone:', '').strip()

            linkedin_url = get_linkedin_url(session, soup, company_name, company_url)

            # Construct the result dictionary
            result = {
                'Name': name,
                'Title': title,
                'Company Name': company_name,
                'Contact Info (nếu có)': contact_info,
                'Domain': "N/A",  # Replace with actual domain if available
                'Sizing': "N/A",    # Replace with actual website if available
                'Linkedin': linkedin_url    # Replace with actual website if available
            }
            results.append(result)

        except Exception as e:
            print(f"Error processing listing: {e}")

    return results

def scrape_all_pages(session, initial_response):
    all_data = []
    response = initial_response

    while True:
        if response.ok:
            # Scrape the current page
            data = scrape(session ,response)
            all_data.extend(data)

            # Get the next page link
            soup = bs.BeautifulSoup(response.content, 'html.parser')
            next_page = get_next_page(soup)
            print(f"Next page URL: {next_page}")

            if next_page:
                response = session.get(next_page, verify=False)
            else:
                print("No more pages to scrape.")
                break
        else:
            print("Failed to access the data page.")
            break

    return all_data

    
def main():
    all_data = []

    payload = {
        'UserName': username,
        'Password': password,
        'remPwd': 'false',
        'Submit': 'Sign In',
        'Destination': '',
        'LoginOrigin': '',
        'OriginSet': 'True',
        'AllowExternalLogins': 'True',
        'DisplayCreateAccountLink': 'True'
    }

    session = requests.Session()

    # Log in to the website
    response = session.post(login_url, data=payload, verify=False)
    if response.ok:
        print("Logged in!")

        # Now navigate to the protected page
        response = session.get(base_url, verify=False)

        # Check if the page was accessed successfully
        if response.ok:
           all_data = scrape_all_pages(session, response)
        else:
            print("Failed to access the data page.")
    else:
        print("Login failed.")

    

    # Create a DataFrame and write to an Excel file
    df = pd.DataFrame(all_data)
    file_name= "vy.xlsx"
    df.to_excel(file_name, index=False)

    print("Data has been written to " + file_name)

if __name__ == "__main__":
    main()